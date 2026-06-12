const STORAGE_KEY = 'clarus_disabled_categories';

function readCategories(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeCategories(categories: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...categories]));
}

export function getDismissedCategories(): Set<string> {
  return readCategories();
}

export function addDismissedCategory(key: string): void {
  const categories = readCategories();
  categories.add(key);
  writeCategories(categories);
}

export function removeDismissedCategory(key: string): void {
  const categories = readCategories();
  categories.delete(key);
  writeCategories(categories);
}

export function clearDismissedCategories(): void {
  localStorage.removeItem(STORAGE_KEY);
}
