function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getSubscriptionState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function enablePush(deviceId, vapidPublicKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error(
      "This browser doesn't support push notifications. On iPhone, add the app to your Home Screen first (Safari → Share → Add to Home Screen), then open it from there."
    );
  }
  if (!vapidPublicKey) {
    throw new Error('The server is not configured for notifications yet (missing VAPID key).');
  }

  if (Notification.permission === 'denied') {
    throw new Error(
      'Notifications are blocked for this site in your browser. Click the padlock/site-info icon next to the address bar → Notifications → Allow, then reload the page and try again.'
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied.');
  }

  const registration = await navigator.serviceWorker.ready;

  // Always start from a clean slate: an existing subscription may have been
  // created against a VAPID key the server no longer signs with (e.g. after
  // the keys were regenerated), and reusing it would silently fail every
  // push. Re-subscribing fresh on every "Enable" tap avoids that entirely.
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, subscription }),
  });

  return subscription;
}

async function disablePush(deviceId) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
  await fetch('/api/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });
}

window.WordPush = { enablePush, disablePush, getSubscriptionState };
