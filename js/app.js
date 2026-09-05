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
window.WordCatchDeviceId = deviceId;
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
        <div class="word-main">${entry.word}${entry.mastered ? ' <span class="badge-mastered">Mastered</span>' : ''}</div>
        <div class="word-sub rtl-text">${entry.translation || 'Translating...'}</div>
        ${entry.sentence ? `<div class="word-sentence">${entry.sentence}</div>` : ''}
      `;
      list.appendChild(item);
    });
}

async function handleAddWord(event) {
  event.preventDefault();
  const wordInput = document.getElementById('word-input');
  const translationInput = document.getElementById('translation-input');
  const sentenceInput = document.getElementById('sentence-input');

  const word = wordInput.value.trim();
  if (!word) return;
  const translation = translationInput.value.trim();
  const sentence = sentenceInput.value.trim();

  wordInput.value = '';
  translationInput.value = '';
  sentenceInput.value = '';
  wordInput.focus();

  const localEntry = {
    word,
    translation,
    sentence,
    addedAt: Date.now(),
    lastNotifiedAt: 0,
    mastered: false,
    correctStreak: 0,
  };
  const id = await WordDb.addWord(localEntry);
  localEntry.id = id;
  await renderWordList();

  try {
    const res = await fetch('/api/add-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, word, translation, sentence }),
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

async function refreshPushButton() {
  const btn = document.getElementById('enable-push');
  const status = document.getElementById('push-status');
  try {
    const subscription = await WordPush.getSubscriptionState();
    if (subscription) {
      btn.textContent = 'Disable notifications';
      btn.dataset.mode = 'disable';
    } else {
      btn.textContent = 'Enable notifications';
      btn.dataset.mode = 'enable';
      status.textContent = '';
    }
  } catch (err) {
    // Push not supported yet (e.g. iOS app not installed to Home Screen).
  }
}

async function handlePushButtonClick() {
  const btn = document.getElementById('enable-push');
  const status = document.getElementById('push-status');

  if (btn.dataset.mode === 'disable') {
    status.textContent = 'Disabling...';
    try {
      await WordPush.disablePush(deviceId);
      status.textContent = 'Notifications disabled on this device.';
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    }
  } else {
    status.textContent = 'Enabling...';
    try {
      await WordPush.enablePush(deviceId, vapidPublicKey);
      status.textContent = 'Notifications enabled on this device.';
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    }
  }
  await refreshPushButton();
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
      } else if (btn.dataset.target === 'add-panel') {
        renderWordList();
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
  document.getElementById('enable-push').addEventListener('click', handlePushButtonClick);
  document.getElementById('show-answer-btn').addEventListener('click', () => WordPractice.showAnswer());
  document.getElementById('learning-btn').addEventListener('click', () => WordPractice.grade(false));
  document.getElementById('know-btn').addEventListener('click', () => WordPractice.grade(true));

  await refreshPushButton();
  await renderWordList();

  const params = new URLSearchParams(window.location.search);
  const practiceWord = params.get('practice');
  if (practiceWord) {
    activatePracticeTab(practiceWord);
  }
});
