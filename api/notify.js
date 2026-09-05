const webpush = require('web-push');
const { kv } = require('@vercel/kv');

// Falls back to the old boolean `mastered` field for words saved before
// categories existed.
function getCategory(word) {
  if (word.category) return word.category;
  return word.mastered ? 'known' : 'learning';
}

// Default quiet hours: 23:00–08:00 in Asia/Jerusalem time. Override with the
// QUIET_HOURS_START / QUIET_HOURS_END / NOTIFY_TIMEZONE env vars if you want
// different hours. This is a safety net — the main control over *when*
// notifications fire is which times you schedule at cron-job.org.
const QUIET_HOURS_START = Number(process.env.QUIET_HOURS_START ?? 23);
const QUIET_HOURS_END = Number(process.env.QUIET_HOURS_END ?? 8);
const TIMEZONE = process.env.NOTIFY_TIMEZONE || 'Asia/Jerusalem';

function isQuietHours() {
  if (QUIET_HOURS_START === QUIET_HOURS_END) return false;
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: TIMEZONE }).format(new Date())
  );
  if (QUIET_HOURS_START < QUIET_HOURS_END) {
    return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
  }
  // Window wraps past midnight, e.g. 23 -> 8.
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

module.exports = async (req, res) => {
  const secret = req.query.secret || (req.body && req.body.secret);
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  if (isQuietHours()) {
    res.status(200).json({ skipped: 'quiet-hours' });
    return;
  }

  webpush.setVapidDetails(
    'https://english-app-clec.vercel.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const subKeys = await kv.keys('sub:*');
  const results = [];

  for (const subKey of subKeys) {
    const deviceId = subKey.replace('sub:', '');
    const subscription = await kv.get(subKey);
    const words = (await kv.get(`words:${deviceId}`)) || [];
    if (!subscription) continue;

    // Don't keep reminding you of words you've already mastered.
    const eligible = words.filter((w) => getCategory(w) !== 'known');
    if (eligible.length === 0) continue;

    eligible.sort((a, b) => (a.lastNotifiedAt || 0) - (b.lastNotifiedAt || 0));
    const pick = eligible[0];
    pick.lastNotifiedAt = Date.now();
    await kv.set(`words:${deviceId}`, words);

    const payload = JSON.stringify({
      title: pick.word,
      body: [pick.translation, pick.sentence].filter(Boolean).join('\n'),
      word: pick.word,
    });

    try {
      await webpush.sendNotification(subscription, payload);
      results.push({ deviceId, word: pick.word, ok: true });
    } catch (err) {
      // web-push's error message alone is too generic to diagnose from;
      // surface the actual status code and response body from the push
      // service so we can see the real reason (mismatched keys, bad JWT,
      // expired endpoint, etc).
      results.push({
        deviceId,
        word: pick.word,
        ok: false,
        error: err.message,
        statusCode: err.statusCode,
        pushServiceBody: err.body,
        endpoint: subscription.endpoint,
      });
      if (err.statusCode === 410 || err.statusCode === 404) {
        await kv.del(subKey);
      }
    }
  }

  res.status(200).json({ sent: results });
};
