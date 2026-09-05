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

function categoryBadge(category) {
  if (category === 'known') return '<span class="badge badge-known">Mastered</span>';
  if (category === 'medium') return '<span class="badge badge-medium">Medium</span>';
  return '';
}

async function deleteWordEverywhere(entry) {
  await WordDb.deleteWord(entry.id);
  fetch('/api/delete-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, word: entry.word }),
  }).catch((err) => console.error('Failed to delete word from server', err));
}

// Two-tap delete confirmation instead of window.confirm(), which behaves
// inconsistently inside installed PWAs.
function wireDeleteButtons(root, words, onDeleted) {
  root.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      if (button.dataset.armed !== 'true') {
        button.dataset.armed = 'true';
        button.textContent = 'Confirm delete?';
        button.classList.add('delete-btn-armed');
        setTimeout(() => {
          if (button.dataset.armed === 'true') {
            button.dataset.armed = 'false';
            button.textContent = 'Delete';
            button.classList.remove('delete-btn-armed');
          }
        }, 3000);
        return;
      }

      const id = Number(button.dataset.id);
      const entry = words.find((w) => w.id === id);
      if (!entry) return;
      await deleteWordEverywhere(entry);
      await onDeleted();
    });
  });
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
        <div class="word-main">${entry.word} ${categoryBadge(WordCategory.getCategory(entry))}</div>
        <div class="word-sub rtl-text">${entry.translation || 'Translating...'}</div>
        ${entry.sentence ? `<div class="word-sentence">${entry.sentence}</div>` : ''}
        <button type="button" class="delete-btn" data-id="${entry.id}">Delete</button>
      `;
      list.appendChild(item);
    });

  wireDeleteButtons(list, words, renderWordList);
}

async function updateWordCategory(word, category) {
  const words = await WordDb.getAllWords();
  const entry = words.find((w) => w.word === word);
  if (!entry) return;
  entry.category = category;
  await WordDb.updateWord(entry);

  fetch('/api/update-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, word, category }),
  }).catch((err) => console.error('Failed to sync category', err));
}

async function renderWordsPage() {
  const words = await WordDb.getAllWords();
  const container = document.getElementById('words-groups');
  container.innerHTML = '';

  const groups = [
    { key: 'learning', label: 'Still learning' },
    { key: 'medium', label: 'Medium' },
    { key: 'known', label: 'Mastered' },
  ];

  groups.forEach(({ key, label }) => {
    const items = words
      .filter((w) => w.word && WordCategory.getCategory(w) === key)
      .sort((a, b) => b.addedAt - a.addedAt);

    const section = document.createElement('div');
    section.className = 'category-group';

    const heading = document.createElement('h2');
    heading.className = 'category-heading';
    heading.textContent = `${label} (${items.length})`;
    section.appendChild(heading);

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state category-empty';
      empty.textContent = 'No words here yet.';
      section.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'word-list';
      items.forEach((entry) => {
        const li = document.createElement('li');
        li.className = 'word-item';
        li.innerHTML = `
          <div class="word-main">${entry.word}</div>
          <div class="word-sub rtl-text">${entry.translation || 'Translating...'}</div>
          ${entry.sentence ? `<div class="word-sentence">${entry.sentence}</div>` : ''}
          <select class="category-select" data-word="${entry.word.replace(/"/g, '&quot;')}">
            ${WordCategory.CATEGORY_ORDER.map(
              (value) =>
                `<option value="${value}" ${value === key ? 'selected' : ''}>${WordCategory.CATEGORY_LABELS[value]}</option>`
            ).join('')}
          </select>
          <button type="button" class="delete-btn" data-id="${entry.id}">Delete</button>
        `;
        list.appendChild(li);
      });
      section.appendChild(list);
    }

    container.appendChild(section);
  });

  container.querySelectorAll('.category-select').forEach((select) => {
    select.addEventListener('change', async (event) => {
      await updateWordCategory(event.target.dataset.word, event.target.value);
      await renderWordsPage();
    });
  });

  wireDeleteButtons(container, words, renderWordsPage);
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
    category: 'learning',
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

  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    status.textContent =
      'Notifications are blocked for this site in your browser. Click the padlock/site-info icon next to the address bar → Notifications → Allow, then reload this page.';
    status.classList.add('push-status-error');
    return;
  }
  status.classList.remove('push-status-error');

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

  status.classList.remove('push-status-error');

  if (btn.dataset.mode === 'disable') {
    status.textContent = 'Disabling...';
    try {
      await WordPush.disablePush(deviceId);
      status.textContent = 'Notifications disabled on this device.';
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
      status.classList.add('push-status-error');
    }
  } else {
    status.textContent = 'Enabling...';
    try {
      await WordPush.enablePush(deviceId, vapidPublicKey);
      status.textContent = 'Notifications enabled on this device.';
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
      status.classList.add('push-status-error');
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
      } else if (btn.dataset.target === 'words-panel') {
        renderWordsPage();
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
  document.getElementById('learning-btn').addEventListener('click', () => WordPractice.grade('learning'));
  document.getElementById('medium-btn').addEventListener('click', () => WordPractice.grade('medium'));
  document.getElementById('know-btn').addEventListener('click', () => WordPractice.grade('known'));

  await refreshPushButton();
  await renderWordList();

  const params = new URLSearchParams(window.location.search);
  const practiceWord = params.get('practice');
  if (practiceWord) {
    activatePracticeTab(practiceWord);
  }
});
