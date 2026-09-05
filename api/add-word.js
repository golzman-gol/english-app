const { kv } = require('@vercel/kv');

async function fetchTranslation(word) {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|he`
    );
    const data = await res.json();
    return data?.responseData?.translatedText || '';
  } catch (err) {
    console.error('Translation lookup failed', err);
    return '';
  }
}

async function fetchExampleSentence(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) return '';
    const data = await res.json();
    const meanings = data?.[0]?.meanings || [];
    for (const meaning of meanings) {
      const withExample = meaning.definitions?.find((d) => d.example);
      if (withExample) return withExample.example;
    }
    return '';
  } catch (err) {
    console.error('Dictionary lookup failed', err);
    return '';
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { deviceId, word, translation: providedTranslation, sentence: providedSentence } = req.body || {};
  const cleanWord = String(word || '').trim();
  if (!deviceId || !cleanWord) {
    res.status(400).json({ error: 'deviceId and word are required' });
    return;
  }

  const manualTranslation = String(providedTranslation || '').trim();
  const manualSentence = String(providedSentence || '').trim();

  // Only ask the free lookup APIs for whatever the user didn't type in themselves.
  const [translation, sentence] = await Promise.all([
    manualTranslation ? Promise.resolve(manualTranslation) : fetchTranslation(cleanWord),
    manualSentence ? Promise.resolve(manualSentence) : fetchExampleSentence(cleanWord),
  ]);

  const entry = {
    word: cleanWord,
    translation,
    sentence,
    addedAt: Date.now(),
    lastNotifiedAt: 0,
    mastered: false,
    correctStreak: 0,
  };

  const key = `words:${deviceId}`;
  const existing = (await kv.get(key)) || [];
  existing.push(entry);
  await kv.set(key, existing);

  res.status(200).json(entry);
};
