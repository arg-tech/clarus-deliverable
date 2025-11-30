import type { LexiconTerm } from '../types';

// For testing change to const USE_TEST_DATA = true;
const USE_TEST_DATA = false;

/**
 * Analyzes text for lexicon terms
 * @param text The raw text to analyze
 * @param language The language code (default: 'en')
 * @returns Promise resolving to an array of LexiconTerm objects
 */
export const analyzeLexiconTerms = async (text: string, language: string = 'en'): Promise<Array<LexiconTerm>> => {
  // If test data is specified, return it immediately
  if (USE_TEST_DATA) {
    return Promise.resolve([...TEST_DATA].sort((a, b) => a.character_positions.start - b.character_positions.start));
  }

  try {
    const response = await fetch(`api/get-lexicon-terms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        language,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: LexiconTerm[] = await response.json();

    // Sort by character position start
    return data.sort((a, b) => a.character_positions.start - b.character_positions.start);
  } catch (error) {
    console.error('Error analyzing lexicon terms:', error);
    throw error;
  }
};

const TEST_DATA: LexiconTerm[] = [
  {
    word: "Blocker",
    definition: "A write blocker is a forensic device that allows read-only access to storage media, preventing any modifications to the original evidence during examination.",
    usage_example: "Faulty displays may hide deeper problems with the write blocker, or may result in misinterpreted details. (procedural/instructive)",
    character_positions: {
      start: 55,
      end: 69
    }
  },
  {
    word: "Encryption",
    definition: "Encrypted refers to data, files, devices, communications, or storage media that have been transformed using cryptographic algorithms into an unreadable format that cannot be accessed, interpreted, or retrieved without the appropriate key, password, or cryptographic method.",
    usage_example: "To date, the optional encryption on most computers and mobiles can be activated by the user. (procedural/instructive)",
    character_positions: {
      start: 24,
      end: 34
    }
  }
];