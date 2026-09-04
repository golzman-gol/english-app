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
  queue = shuffle(words.filter((w) => w.word));
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

function renderCard() {
  const card = document.getElementById('flashcard');
  const progress = document.getElementById('practice-progress');

  if (queue.length === 0) {
    card.innerHTML = '<p class="empty-state">הוסף מילים בלשונית "הוספה" כדי להתחיל להתאמן.</p>';
    progress.textContent = '';
    return;
  }
  if (currentIndex >= queue.length) {
    card.innerHTML = '<p class="empty-state">סיימת את כל המילים! 🎉</p>';
    progress.textContent = '';
    return;
  }

  const entry = queue[currentIndex];
  card.dataset.flipped = 'false';
  card.innerHTML = `
    <div class="card-face card-front">${entry.word}</div>
    <div class="card-face card-back rtl-text" hidden>
      <div class="card-translation">${entry.translation || '—'}</div>
      ${entry.sentence ? `<div class="card-sentence">${entry.sentence}</div>` : ''}
    </div>
  `;
  progress.textContent = `${currentIndex + 1} / ${queue.length}`;
}

function flip() {
  const card = document.getElementById('flashcard');
  const front = card.querySelector('.card-front');
  const back = card.querySelector('.card-back');
  if (!front || !back) return;
  const flipped = card.dataset.flipped === 'true';
  front.hidden = !flipped;
  back.hidden = flipped;
  card.dataset.flipped = flipped ? 'false' : 'true';
}

function next() {
  currentIndex += 1;
  renderCard();
}

window.WordPractice = { start, flip, next };
