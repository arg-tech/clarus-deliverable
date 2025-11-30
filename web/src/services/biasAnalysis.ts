import type { BiasIndicator, RawBiasIndicator } from '../types';
import { addCharacterPositions, limitIndicatorsByKey } from './analysisHelpers';

// For testing change to const USE_TEST_DATA: false | keyof typeof TEST_DATA = 'basic';
const USE_TEST_DATA: false | keyof typeof TEST_DATA = false;

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
 * Analyzes text for bias indicators
 * @param text The raw text to analyze
 * @param richText The rich text version (with formatting)
 * @param language The language code (default: 'en')
 * @returns Promise resolving to an array of BiasIndicator objects
 */
export const analyzeBiasIndicators = async (text: string, richText: string, language: string = 'en'): Promise<Array<BiasIndicator>> => { 
  let rawData: Array<RawBiasIndicator | TestBiasIndicator> = [];

  // If test data is specified, return it immediately
  if (USE_TEST_DATA) {
    rawData = TEST_DATA[USE_TEST_DATA]; 
  } else {
      const response = await fetch('/api/analyse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, richText, language }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    rawData = await response.json()
  }
  
  // Some indicators are limited to not overwhelm the UI
  const finalData = limitIndicatorsByKey(rawData, ['sarcasm', 'passiveVoice'], 3);
  
  return addCharacterPositions(finalData, text);
};

// Test data sets for development and testing
// Todo: Move to a proper test framework
const TEST_DATA = {
  // Uncomment character_positions if desired
  basic: [
    {
      bias_indicator_key: 'overgeneralizations',
      // character_positions: { start: 0, end: 5 },
      detected_phrase: 'example'
    },
    {
      bias_indicator_key: 'overgeneralizations',
      // character_positions: { start: 7, end: 10 },
      detected_phrase: 'another',
    },
    {
      bias_indicator_key: 'overgeneralizations',
      // character_positions: { start: 0, end: 12 },
      detected_phrase: 'This entire example sentence is example another',
    },
    // Rhetorical question example with confidence field
    {
      bias_indicator_key: 'rhetoricalQuestion',
      detected_phrase: 'Is this a rhetorical question?',
      confidence: '92%'
    },
  ]
};
