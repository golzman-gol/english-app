const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { deviceId, word, mastered, correctStreak } = req.body || {};
  if (!deviceId || !word) {
    res.status(400).json({ error: 'deviceId and word are required' });
    return;
  }

  const key = `words:${deviceId}`;
  const words = (await kv.get(key)) || [];
  const idx = words.findIndex((w) => w.word.toLowerCase() === String(word).toLowerCase());
  if (idx === -1) {
    // Nothing to sync yet (e.g. the word was added before this device had a connection) — not an error.
    res.status(200).json({ ok: true, synced: false });
    return;
  }

  if (typeof mastered === 'boolean') words[idx].mastered = mastered;
  if (typeof correctStreak === 'number') words[idx].correctStreak = correctStreak;
  await kv.set(key, words);

  res.status(200).json({ ok: true, synced: true, entry: words[idx] });
};
