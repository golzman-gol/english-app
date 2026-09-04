const webpush = require('web-push');
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  const secret = req.query.secret || (req.body && req.body.secret);
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  webpush.setVapidDetails(
    'mailto:notifications@word-catch.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const subKeys = await kv.keys('sub:*');
  const results = [];

  for (const subKey of subKeys) {
    const deviceId = subKey.replace('sub:', '');
    const subscription = await kv.get(subKey);
    const words = (await kv.get(`words:${deviceId}`)) || [];
    if (!subscription || words.length === 0) continue;

    words.sort((a, b) => (a.lastNotifiedAt || 0) - (b.lastNotifiedAt || 0));
    const pick = words[0];
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
      results.push({ deviceId, word: pick.word, ok: false, error: err.message });
      if (err.statusCode === 410 || err.statusCode === 404) {
        await kv.del(subKey);
      }
    }
  }

  res.status(200).json({ sent: results });
};
