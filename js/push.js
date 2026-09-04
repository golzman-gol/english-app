function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function enablePush(deviceId, vapidPublicKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('דפדפן זה לא תומך בהתראות. הוסף את האפליקציה למסך הבית כדי לאפשר התראות ב-iPhone.');
  }
  if (!vapidPublicKey) {
    throw new Error('השרת עדיין לא הוגדר להתראות (חסר מפתח VAPID).');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('ההרשאה להתראות נדחתה.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, subscription }),
  });

  return subscription;
}

window.WordPush = { enablePush };
