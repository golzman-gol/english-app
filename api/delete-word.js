const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { deviceId, word } = req.body || {};
  if (!deviceId || !word) {
    res.status(400).json({ error: 'deviceId and word are required' });
    return;
  }

  const key = `words:${deviceId}`;
  const words = (await kv.get(key)) || [];
  const filtered = words.filter((w) => w.word.toLowerCase() !== String(word).toLowerCase());
  await kv.set(key, filtered);

  res.status(200).json({ ok: true });
};
