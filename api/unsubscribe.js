const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { deviceId } = req.body || {};
  if (!deviceId) {
    res.status(400).json({ error: 'deviceId is required' });
    return;
  }

  await kv.del(`sub:${deviceId}`);
  res.status(200).json({ ok: true });
};
