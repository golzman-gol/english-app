const webpush = require('web-push');

// Temporary one-off endpoint: generates a VAPID key pair using the exact
// same library (and version) that signs our push requests, guaranteeing
// compatibility. Safe to call repeatedly — each call just makes a new pair;
// nothing is stored until you copy the values into Vercel's env vars.
module.exports = (req, res) => {
  const keys = webpush.generateVAPIDKeys();
  res.status(200).json(keys);
};
