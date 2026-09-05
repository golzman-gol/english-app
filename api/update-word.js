const { kv } = require('@vercel/kv');

const VALID_CATEGORIES = new Set(['learning', 'medium', 'known']);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { deviceId, word, category } = req.body || {};
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

  if (typeof category === 'string' && VALID_CATEGORIES.has(category)) {
    words[idx].category = category;
  }
  await kv.set(key, words);

  res.status(200).json({ ok: true, synced: true, entry: words[idx] });
};
