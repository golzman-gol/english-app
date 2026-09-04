const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { deviceId, subscription } = req.body || {};
  if (!deviceId || !subscription) {
    res.status(400).json({ error: 'deviceId and subscription are required' });
    return;
  }

  await kv.set(`sub:${deviceId}`, subscription);
  res.status(200).json({ ok: true });
};
