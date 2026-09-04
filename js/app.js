const DEVICE_ID_KEY = 'word-catch-device-id';

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

const deviceId = getDeviceId();
let vapidPublicKey = '';

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/sw.js');
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    vapidPublicKey = data.vapidPublicKey || '';
  } catch (err) {
    console.error('Failed to load config', err);
  }
}

async function renderWordList() {
  const words = await WordDb.getAllWords();
  const list = document.getElementById('word-list');
  list.innerHTML = '';

  words
    .sort((a, b) => b.addedAt - a.addedAt)
    .forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'word-item';
      item.innerHTML = `
        <div class="word-main">${entry.word}</div>
        <div class="word-sub rtl-text">${entry.translation || 'מתרגם...'}</div>
        ${entry.sentence ? `<div class="word-sentence">${entry.sentence}</div>` : ''}
      `;
      list.appendChild(item);
    });
}

async function handleAddWord(event) {
  event.preventDefault();
  const input = document.getElementById('word-input');
  const word = input.value.trim();
  if (!word) return;
  input.value = '';
  input.focus();

  const localEntry = { word, translation: '', sentence: '', addedAt: Date.now(), lastNotifiedAt: 0 };
  const id = await WordDb.addWord(localEntry);
  localEntry.id = id;
  await renderWordList();

  try {
    const res = await fetch('/api/add-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, word }),
    });
    if (res.ok) {
      const enriched = await res.json();
      localEntry.translation = enriched.translation;
      localEntry.sentence = enriched.sentence;
      await WordDb.updateWord(localEntry);
      await renderWordList();
    }
  } catch (err) {
    console.error('Enrichment failed, word saved locally only', err);
  }
}

async function handleEnableNotifications() {
  const status = document.getElementById('push-status');
  status.textContent = 'מפעיל...';
  try {
    await WordPush.enablePush(deviceId, vapidPublicKey);
    status.textContent = 'התראות פעילות ✔';
  } catch (err) {
    status.textContent = `שגיאה: ${err.message}`;
  }
}

function setupTabs() {
  document.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
      if (btn.dataset.target === 'practice-panel') {
        WordPractice.start();
      }
    });
  });
}

function activatePracticeTab(word) {
  document.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.querySelector('[data-target="practice-panel"]').classList.add('active');
  document.getElementById('practice-panel').classList.add('active');
  WordPractice.start(word);
}

window.addEventListener('DOMContentLoaded', async () => {
  await registerServiceWorker();
  await loadConfig();
  setupTabs();

  document.getElementById('add-word-form').addEventListener('submit', handleAddWord);
  document.getElementById('enable-push').addEventListener('click', handleEnableNotifications);
  document.getElementById('flip-btn').addEventListener('click', () => WordPractice.flip());
  document.getElementById('next-btn').addEventListener('click', () => WordPractice.next());

  await renderWordList();

  const params = new URLSearchParams(window.location.search);
  const practiceWord = params.get('practice');
  if (practiceWord) {
    activatePracticeTab(practiceWord);
  }
});
