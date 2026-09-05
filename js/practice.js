let queue = [];
let currentIndex = 0;

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function start(preferredWord) {
  const words = await WordDb.getAllWords();
  const active = words.filter((w) => w.word && !w.mastered);
  const mastered = words.filter((w) => w.word && w.mastered);
  // Mastered words still show up occasionally so they don't fade away completely,
  // just far less often than words you're still learning.
  const masteredSample = shuffle(mastered).slice(0, Math.ceil(mastered.length * 0.2));

  queue = shuffle([...active, ...masteredSample]);

  if (preferredWord) {
    const idx = queue.findIndex((w) => w.word.toLowerCase() === preferredWord.toLowerCase());
    if (idx > 0) {
      const [entry] = queue.splice(idx, 1);
      queue.unshift(entry);
    }
  }

  currentIndex = 0;
  renderCard();
}

function setControls(showAnswer, grade) {
  document.getElementById('show-answer-controls').hidden = !showAnswer;
  document.getElementById('grade-controls').hidden = !grade;
}

function renderCard() {
  const card = document.getElementById('flashcard');
  const progress = document.getElementById('practice-progress');

  if (queue.length === 0) {
    card.innerHTML = '<p class="empty-state">Add some words in the Add tab to start practicing.</p>';
    progress.textContent = '';
    setControls(false, false);
    return;
  }
  if (currentIndex >= queue.length) {
    card.innerHTML = '<p class="empty-state">You went through all your words! 🎉</p>';
    progress.textContent = '';
    setControls(false, false);
    return;
  }

  const entry = queue[currentIndex];
  card.innerHTML = `<div class="card-front">${entry.word}</div>`;
  progress.textContent = `${currentIndex + 1} / ${queue.length}`;
  setControls(true, false);
}

function showAnswer() {
  if (currentIndex >= queue.length) return;
  const entry = queue[currentIndex];
  const card = document.getElementById('flashcard');
  card.innerHTML = `
    <div class="card-front">${entry.word}</div>
    <div class="card-back rtl-text">
      <div class="card-translation">${entry.translation || '—'}</div>
      ${entry.sentence ? `<div class="card-sentence">${entry.sentence}</div>` : ''}
    </div>
  `;
  setControls(false, true);
}

async function grade(knewIt) {
  if (currentIndex >= queue.length) return;
  const entry = queue[currentIndex];

  entry.correctStreak = knewIt ? (entry.correctStreak || 0) + 1 : 0;
  entry.mastered = entry.correctStreak >= 3;

  try {
    await WordDb.updateWord(entry);
  } catch (err) {
    console.error('Failed to save progress locally', err);
  }

  fetch('/api/update-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: window.WordCatchDeviceId,
      word: entry.word,
      mastered: entry.mastered,
      correctStreak: entry.correctStreak,
    }),
  }).catch((err) => console.error('Failed to sync progress', err));

  currentIndex += 1;
  renderCard();
}

window.WordPractice = { start, showAnswer, grade };
