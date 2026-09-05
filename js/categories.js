const CATEGORY_ORDER = ['learning', 'medium', 'known'];
const CATEGORY_LABELS = {
  learning: 'Still learning',
  medium: 'Medium',
  known: 'Mastered',
};

// Falls back to the old boolean `mastered` field for words saved before
// categories existed, so nothing already in IndexedDB/KV breaks.
function getCategory(entry) {
  if (entry.category) return entry.category;
  return entry.mastered ? 'known' : 'learning';
}

window.WordCategory = { CATEGORY_ORDER, CATEGORY_LABELS, getCategory };
