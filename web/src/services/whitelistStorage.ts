const STORAGE_KEY = 'clarus_whitelisted_phrases';

function readPhrases(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writePhrases(phrases: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...phrases]));
}

export function getWhitelistedPhrases(): Set<string> {
  return readPhrases();
}

export function addWhitelistedPhrase(phrase: string): void {
  const phrases = readPhrases();
  phrases.add(phrase.toLowerCase());
  writePhrases(phrases);
}

export function removeWhitelistedPhrase(phrase: string): void {
  const phrases = readPhrases();
  phrases.delete(phrase.toLowerCase());
  writePhrases(phrases);
}

export function clearWhitelistedPhrases(): void {
  localStorage.removeItem(STORAGE_KEY);
}
