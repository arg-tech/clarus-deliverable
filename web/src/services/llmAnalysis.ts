import type { BiasIndicator, RawBiasIndicator } from '../types';
import { addCharacterPositions, filterIndicatorsInText, limitIndicatorsByKey } from './analysisHelpers';

// For testing change to const USE_TEST_DATA: false | keyof typeof TEST_DATA = 'basic';
const USE_TEST_DATA: false | keyof typeof TEST_DATA = false;


/**
 * Analyzes text for bias indicators using LLM
 * @param text The raw text to analyze
 * @param richText The rich text version (with formatting)
 * @param language The language code (default: 'en')
 * @param model The model to use for analysis ('local' or 'remote', default: 'local')
 * @returns Promise resolving to an object with bias indicators, model used, and fallback status
 */
export const analyzeLLMIndicators = async (text: string, richText: string, language: string = 'en', model: 'local' | 'remote' = 'local'): Promise<{ indicators: Array<BiasIndicator>; modelUsed: string; isFallback: boolean }> => {
  let rawData: Array<RawBiasIndicator> = [];
  let modelUsed: string = '';
  let isFallback: boolean = false;

  // If test data is specified, return it immediately
  if (USE_TEST_DATA) {
    rawData = TEST_DATA[USE_TEST_DATA];
    modelUsed = 'test-model';
    isFallback = false;
  } else {
    const response = await fetch('/api/llm-analyse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, richText, language, model_to_use: model }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error === 'context_length_exceeded') {
        throw new Error('CONTEXT_LENGTH_EXCEEDED');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    rawData = responseData.bias_indicators;
    modelUsed = responseData.model_used;
    isFallback = responseData.is_fallback || false;
  }

  const filteredBiasIndicators = filterIndicatorsInText(rawData, text);
  console.log(`Filtered out ${rawData.length - filteredBiasIndicators.length} LLM-based indicators not found in text`);
  
  // Some indicators are limited to not overwhelm the UI
  const allIndicatorKeys = [...new Set(filteredBiasIndicators.map(ind => ind.bias_indicator_key))];
  const limitedBiasIndicators = limitIndicatorsByKey(filteredBiasIndicators, allIndicatorKeys, 3);
  
  return {
    indicators: addCharacterPositions(limitedBiasIndicators, text),
    modelUsed,
    isFallback
  };
};

// Test data sets for development and testing
const TEST_DATA = {
  // Basic LLM-detected examples
  basic: [
    {
      bias_indicator_key: 'overgeneralizations',
      detected_phrase: 'clearly',
    },
    {
      bias_indicator_key: 'overgeneralizations',
      detected_phrase: 'obviously',
    },
    {
      bias_indicator_key: 'overgeneralizations',
      detected_phrase: 'everyone knows',
    },
    {
      bias_indicator_key: 'overgeneralizations',
      detected_phrase: 'everyone knows',
    },
  ]
};