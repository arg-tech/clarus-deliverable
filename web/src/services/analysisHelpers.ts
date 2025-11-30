import type { BiasIndicator, RawBiasIndicator } from '../types';

/**
 * Type for test data which may have legacy format with optional character_positions
 */
interface TestBiasIndicator extends RawBiasIndicator {
  character_positions?: {
    start: number;
    end: number;
  };
}

/**
 * Filters out bias indicators whose detected phrases don't appear in the text
 * Indicators that already have character_positions are always kept
 * @param indicators The array of raw bias indicators to filter
 * @param text The text to search in
 * @returns Filtered array containing only indicators whose phrases are found in the text or have pre-existing positions
 */
export const filterIndicatorsInText = (
  indicators: Array<RawBiasIndicator | TestBiasIndicator>,
  text: string
): Array<RawBiasIndicator | TestBiasIndicator> => {
  return indicators.filter(indicator => {
    // Always keep indicators that already have character_positions
    if ('character_positions' in indicator && indicator.character_positions) {
      return true;
    }

    // Filter out empty or whitespace-only phrases
    if (!indicator.detected_phrase || indicator.detected_phrase.trim() === '') {
      return false;
    }

    // Check if the phrase exists in the text (case-insensitive)
    // Note: currently doesn't respect word boundaries like findPhrasePositions
    const lowerText = text.toLowerCase();
    const lowerPhrase = indicator.detected_phrase.toLowerCase();

    // Keep the indicator if the phrase is found in the text
    return lowerText.includes(lowerPhrase);
  });
};

/**
 * Limits the number of indicators per bias_indicator_key
 * @param indicators Array of bias indicators
 * @param keysToLimit Array of bias_indicator_key values to limit. Pass empty array or undefined to limit all keys
 * @param maxPerKey Maximum number of indicators to keep per key (default: 3)
 * @returns Filtered array with at most maxPerKey indicators per key
 */
export const limitIndicatorsByKey = (
  indicators: Array<RawBiasIndicator>,
  keysToLimit: string[] | undefined,
  maxPerKey: number = 3
): Array<RawBiasIndicator> => {
  const keysSet = keysToLimit && keysToLimit.length > 0 
    ? new Set(keysToLimit) 
    : new Set(indicators.map(ind => ind.bias_indicator_key));
  
  const toLimit = indicators.filter(ind => keysSet.has(ind.bias_indicator_key));
  const others = indicators.filter(ind => !keysSet.has(ind.bias_indicator_key));
  
  const grouped = toLimit.reduce((acc, indicator) => {
    const key = indicator.bias_indicator_key;
    if (!acc[key]) acc[key] = [];
    acc[key].push(indicator);
    return acc;
  }, {} as Record<string, Array<RawBiasIndicator>>);
  
  return [...Object.values(grouped).flatMap(group => group.slice(0, maxPerKey)), ...others];
};

/**
 * Processes raw bias indicators to ensure they all have character positions
 * Calculates positions based on the detected_phrase and the text
 * @param indicators The original array of raw bias indicators from the backend
 * @param text The text to search in for position calculation
 * @returns Array of processed BiasIndicator objects with character positions
 */
export const addCharacterPositions = (indicators: Array<RawBiasIndicator | TestBiasIndicator>, text: string): Array<BiasIndicator> => {
  // Keep track of phrases we've seen to ensure repeated phrases are distributed correctly
  const phraseOccurrenceCount: Record<string, number> = {};

  return indicators.map(indicator => {
    // Check if the indicator already has character_positions
    if ('character_positions' in indicator && indicator.character_positions) {
      return {
        ...indicator,
        character_positions: indicator.character_positions
      } as BiasIndicator;
    }

    // Find all positions of the detected phrase in the text
    const positions = findPhrasePositions(text, indicator.detected_phrase);

    console.log(`Positions for "${indicator.detected_phrase}":`, positions);

    // If we found at least one position
    if (positions.length > 0) {
      // Check if we've seen this phrase before and use the occurrence count to determine the position index
      const phrase = indicator.detected_phrase.toLowerCase();
      phraseOccurrenceCount[phrase] = phraseOccurrenceCount[phrase] || 0;
      const positionIndex = Math.min(phraseOccurrenceCount[phrase], positions.length - 1);
      phraseOccurrenceCount[phrase]++;

      return {
        ...indicator,
        character_positions: positions[positionIndex]
      };
    }

    // If no match was found, create a fallback position
    // This is to prevent issues with components expecting positions
    return {
      ...indicator,
      character_positions: { start: 0, end: Math.max(1, indicator.detected_phrase.length) }
    };
  });
};

/**
 * Find all instances of a phrase in text and return their character positions
 * @param text The text to search in
 * @param phrase The phrase to find
 * @returns Array of position objects with start and end indices
 */
export const findPhrasePositions = (text: string, phrase: string): Array<{start: number, end: number}> => {
  const positions: Array<{start: number, end: number}> = [];
  if (!phrase || phrase.trim() === '') return positions;

  const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapes regex special chars
  
  // Use negative lookahead/lookbehind to ensure not surrounded by word characters
  // (?<!\w) = not preceded by word character
  // (?!\w) = not followed by word character
  const regex = new RegExp(`(?<!\\w)${escapedPhrase}(?!\\w)`, 'gi');

  let match;
  while ((match = regex.exec(text)) !== null) {
    positions.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return positions;
};