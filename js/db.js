const DB_NAME = 'word-catch';
const DB_VERSION = 1;
const STORE = 'words';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(mode, callback) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const request = callback(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

function addWord(entry) {
  return withStore('readwrite', (store) => store.add(entry));
}

function updateWord(entry) {
  return withStore('readwrite', (store) => store.put(entry));
}

function getAllWords() {
  return withStore('readonly', (store) => store.getAll());
}

function deleteWord(id) {
  return withStore('readwrite', (store) => store.delete(id));
}

window.WordDb = { addWord, updateWord, getAllWords, deleteWord };
