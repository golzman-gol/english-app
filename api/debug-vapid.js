const crypto = require('crypto');

function base64UrlToBuffer(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

function bufferToBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Temporary diagnostic endpoint: confirms whether VAPID_PRIVATE_KEY actually
// corresponds to VAPID_PUBLIC_KEY, without ever exposing the private key
// itself. Safe to leave public since VAPID public keys aren't secret.
module.exports = (req, res) => {
  const configuredPublicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';

  if (!configuredPublicKey || !privateKey) {
    res.status(200).json({ error: 'Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY' });
    return;
  }

  try {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(base64UrlToBuffer(privateKey));
    const derivedPublicKey = bufferToBase64Url(ecdh.getPublicKey(null, 'uncompressed'));

    res.status(200).json({
      configuredPublicKey,
      derivedPublicKey,
      match: derivedPublicKey === configuredPublicKey,
      privateKeyByteLength: base64UrlToBuffer(privateKey).length,
      publicKeyByteLength: base64UrlToBuffer(configuredPublicKey).length,
    });
  } catch (err) {
    res.status(200).json({ error: err.message });
  }
};
