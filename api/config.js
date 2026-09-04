module.exports = (req, res) => {
  res.status(200).json({ vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '' });
};
