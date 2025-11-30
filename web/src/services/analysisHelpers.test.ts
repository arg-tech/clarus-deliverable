import { describe, it, expect } from 'vitest';
import { findPhrasePositions, addCharacterPositions, filterIndicatorsInText, limitIndicatorsByKey } from './analysisHelpers';
import type { RawBiasIndicator } from '../types';

describe('findPhrasePositions', () => {
  describe('Basic functionality', () => {
    it('should find a single occurrence of a phrase', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const phrase = 'brown fox';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 10, end: 19 });
    });

    it('should find multiple occurrences of a phrase', () => {
      const text = 'the cat and the dog and the bird';
      const phrase = 'the';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ start: 0, end: 3 });
      expect(result[1]).toEqual({ start: 12, end: 15 });
      expect(result[2]).toEqual({ start: 24, end: 27 });
    });

    it('should return empty array when phrase is not found', () => {
      const text = 'The quick brown fox';
      const phrase = 'elephant';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });
  });

  describe('Case insensitivity', () => {
    it('should find phrase regardless of case differences', () => {
      const text = 'The Quick BROWN Fox';
      const phrase = 'quick brown';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 4, end: 15 });
    });

    it('should find uppercase phrase in lowercase text', () => {
      const text = 'hello world';
      const phrase = 'HELLO';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 0, end: 5 });
    });

    it('should find mixed case occurrences', () => {
      const text = 'TEST test TeSt';
      const phrase = 'test';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ start: 0, end: 4 });
      expect(result[1]).toEqual({ start: 5, end: 9 });
      expect(result[2]).toEqual({ start: 10, end: 14 });
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for empty phrase', () => {
      const text = 'Some text here';
      const phrase = '';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace-only phrase', () => {
      const text = 'Some text here';
      const phrase = '   ';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle empty text', () => {
      const text = '';
      const phrase = 'test';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should find phrase at the start of text', () => {
      const text = 'Hello world';
      const phrase = 'Hello';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 0, end: 5 });
    });

    it('should find phrase at the end of text', () => {
      const text = 'Hello world';
      const phrase = 'world';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 6, end: 11 });
    });

    it('should find phrase that is the entire text', () => {
      const text = 'test';
      const phrase = 'test';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 0, end: 4 });
    });
  });

  describe('Overlapping occurrences', () => {
    it('should not find overlapping occurrences within a single word', () => {
      const text = 'aaaa';
      const phrase = 'aa';
      const result = findPhrasePositions(text, phrase);

      // Should not match because "aa" would be within the word "aaaa"
      expect(result).toHaveLength(0);
    });

    it('should not find overlapping patterns within a single word', () => {
      const text = 'ababa';
      const phrase = 'aba';
      const result = findPhrasePositions(text, phrase);

      // Should not match because "aba" would be within the word "ababa"
      expect(result).toHaveLength(0);
    });
  });

  describe('Word boundary behavior', () => {
    it('should not find phrases within words (should respect word boundaries)', () => {
      const text = 'The catcher cat other things';
      const phrase = 'cat';
      const result = findPhrasePositions(text, phrase);

      // Should only find the standalone word "cat", not "cat" within "catches"
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 12, end: 15 });
    });
  });

  describe('Special characters and punctuation', () => {
    it('should find phrase with punctuation', () => {
      const text = 'Hello, world! How are you?';
      const phrase = 'world!';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 7, end: 13 });
    });

    it('should find phrase with punctuation', () => {
      const text = 'Hello, world! How are you?';
      const phrase = 'world';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 7, end: 12 });
    });

    it('should find phrase with special characters', () => {
      const text = 'Price is $100.00 today';
      const phrase = '$100.00';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 9, end: 16 });
    });

    it('should handle phrases with newlines', () => {
      const text = 'Line one\nLine two\nLine three';
      const phrase = 'line two';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 9, end: 17 });
    });
  });

  describe('Multi-word phrases', () => {
    it('should find multi-word phrase with spaces', () => {
      const text = 'This is a test of the emergency broadcast system';
      const phrase = 'emergency broadcast system';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 22, end: 48 });
    });

    it('should find repeated multi-word phrases', () => {
      const text = 'hello world, goodbye world, hello world';
      const phrase = 'hello world';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ start: 0, end: 11 });
      expect(result[1]).toEqual({ start: 28, end: 39 });
    });

    it('should find multi-word phrase with punctuation', () => {
      const text = 'Wait now... what happened? Wait now... I forgot.';
      const phrase = 'Wait now';
      const result = findPhrasePositions(text, phrase);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ start: 0, end: 8 });
      expect(result[1]).toEqual({ start: 27, end: 35 });
    });
  });

  describe('Unicode and special text', () => {
    it('should handle accented characters', () => {
      const text = 'café résumé naïve';
      const phrase = 'résumé';
      const result = findPhrasePositions(text, phrase);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 5, end: 11 });
    });
  });
});

describe('addCharacterPositions', () => {
  describe('Basic functionality', () => {
    it('should add character positions to indicator without positions', () => {
      const text = 'The politician absolutely failed to address concerns.';
      const indicators: RawBiasIndicator[] = [{
        bias_indicator_key: 'overgeneralisation',
        detected_phrase: 'absolutely'
      }];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].character_positions).toEqual({ start: 15, end: 25 });
      expect(result[0].detected_phrase).toBe('absolutely');
    });

    it('should process multiple indicators', () => {
      const text = 'This is clearly wrong and absolutely incorrect.';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'clearly'
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'absolutely'
        }
      ];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(2);
      expect(result[0].character_positions).toEqual({ start: 8, end: 15 });
      expect(result[1].character_positions).toEqual({ start: 26, end: 36 });
    });

    it('should return empty array for empty input', () => {
      const text = 'Some text here';
      const indicators: RawBiasIndicator[] = [];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });
  });

  describe('Preserving existing character positions', () => {
    it('should preserve character_positions if already present', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const indicators: Array<RawBiasIndicator> = [{
        bias_indicator_key: 'overgeneralisation',
        detected_phrase: 'quick',
        character_positions: { start: 10, end: 20 }
      }];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].character_positions).toEqual({ start: 10, end: 20 });
    });

    it('should preserve existing positions even if they differ from actual text positions', () => {
      const text = 'Hello world';
      const indicators: Array<RawBiasIndicator> = [{
        bias_indicator_key: 'overgeneralisation',
        detected_phrase: 'Hello',
        character_positions: { start: 100, end: 105 } // Intentionally wrong
      }];

      const result = addCharacterPositions(indicators, text);

      expect(result[0].character_positions).toEqual({ start: 100, end: 105 });
    });

    it('should mix indicators with and without positions', () => {
      const text = 'First word and second word';
      const indicators: Array<RawBiasIndicator> = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'First',
          character_positions: { start: 0, end: 5 }
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'second',
        }
      ];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(2);
      expect(result[0].character_positions).toEqual({ start: 0, end: 5 });
      expect(result[1].character_positions).toEqual({ start: 15, end: 21 });
    });
  });

  describe('Handling repeated phrases', () => {
    it('should distribute repeated phrases across multiple indicators', () => {
      const text = 'The cat sat on the mat and the dog ran';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'the',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'the',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'the',
        }
      ];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(3);
      expect(result[0].character_positions).toEqual({ start: 0, end: 3 });   // First "the"
      expect(result[1].character_positions).toEqual({ start: 15, end: 18 }); // Second "the"
      expect(result[2].character_positions).toEqual({ start: 27, end: 30 }); // Third "the"
    });

    it('should handle more indicators than phrase occurrences', () => {
      const text = 'There is clearly a problem here';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'clearly',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'clearly',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'clearly',
        }
      ];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(3);
      expect(result[0].character_positions).toEqual({ start: 9, end: 16 });
      expect(result[1].character_positions).toEqual({ start: 9, end: 16 }); // Same position
      expect(result[2].character_positions).toEqual({ start: 9, end: 16 }); // Same position
    });

    it('should handle case-insensitive phrase matching for distribution', () => {
      const text = 'The Test and the TEST and THE test';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'The',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'the',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'THE',
        }
      ];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(3);
      expect(result[0].character_positions).toEqual({ start: 0, end: 3 });
      expect(result[1].character_positions).toEqual({ start: 13, end: 16 });
      expect(result[2].character_positions).toEqual({ start: 26, end: 29 });
    });
  });

  describe('Fallback behavior', () => {
    it('should create fallback position when phrase not found', () => {
      const text = 'This is some text';
      const indicators: RawBiasIndicator[] = [{
        bias_indicator_key: 'overgeneralisation',
        detected_phrase: 'elephant',
      }];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].character_positions).toEqual({ start: 0, end: 8 }); // Length of "elephant"
    });

    it('should use length 1 as minimum for fallback end position', () => {
      const text = 'Test text';
      const indicators: RawBiasIndicator[] = [{
        bias_indicator_key: 'overgeneralisation',
        detected_phrase: '',
      }];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].character_positions).toEqual({ start: 0, end: 1 });
    });

    it('should handle multiple not-found phrases', () => {
      const text = 'Real content here';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'missing',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'absent',
        }
      ];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(2);
      expect(result[0].character_positions).toEqual({ start: 0, end: 7 }); // Length of "missing"
      expect(result[1].character_positions).toEqual({ start: 0, end: 6 }); // Length of "absent"
    });
  });

  describe('Case sensitivity handling', () => {
    it('should find phrases regardless of case', () => {
      const text = 'The POLITICIAN made a Statement';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'politician',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'statement',
        }
      ];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(2);
      expect(result[0].character_positions).toEqual({ start: 4, end: 14 });
      expect(result[1].character_positions).toEqual({ start: 22, end: 31 });
    });
  });

  describe('Real-world bias detection scenarios', () => {
    it('should handle multiple bias types in article text', () => {
      const text = 'The politician clearly failed to address the concerns. This is absolutely unacceptable.';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'clearly',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'absolutely',
        }
      ];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(2);
      expect(result[0].character_positions).toEqual({ start: 15, end: 22 });
      expect(result[1].character_positions).toEqual({ start: 63, end: 73 });


    });

    it('should preserve all indicator properties', () => {
      const text = 'This is clearly wrong';
      const indicators: RawBiasIndicator[] = [{
        bias_indicator_key: 'overgeneralisation',
        detected_phrase: 'clearly',
      }];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        bias_indicator_key: 'overgeneralisation',
        detected_phrase: 'clearly',
        character_positions: { start: 8, end: 15 }
      });
    });

    it('should handle complex text with punctuation', () => {
      const text = 'The data clearly shows, without a doubt, that this is absolutely correct!';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'clearly',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'absolutely',
        }
      ];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(2);
      expect(result[0].character_positions).toEqual({ start: 9, end: 16 });
      expect(result[1].character_positions).toEqual({ start: 54, end: 64 });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty text', () => {
      const text = '';
      const indicators: RawBiasIndicator[] = [{
        bias_indicator_key: 'overgeneralisation',
        detected_phrase: 'test',
      }];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].character_positions).toEqual({ start: 0, end: 4 }); // Fallback
    });

    it('should handle indicators with multi-word phrases', () => {
      const text = 'This is absolutely and completely wrong in every way';
      const indicators: RawBiasIndicator[] = [{
        bias_indicator_key: 'overgeneralisation',
        detected_phrase: 'absolutely and completely',
      }];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].character_positions).toEqual({ start: 8, end: 33 });
    });

    it('should handle special characters in phrases', () => {
      const text = 'The cost is $100.00 exactly';
      const indicators: RawBiasIndicator[] = [{
        bias_indicator_key: 'overgeneralisation',
        detected_phrase: '$100.00',
      }];

      const result = addCharacterPositions(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].character_positions).toEqual({ start: 12, end: 19 });
    });
  });
});

describe('filterIndicatorsInText', () => {
  describe('Basic filtering', () => {
    it('should keep indicators whose phrases are found in text', () => {
      const text = 'This is clearly a test';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'clearly',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].detected_phrase).toBe('clearly');
    });

    it('should remove indicators whose phrases are not found in text', () => {
      const text = 'This is a simple test';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'elephant',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should filter mixed indicators correctly', () => {
      const text = 'This is clearly wrong but not terrible';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'clearly',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'elephant',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'terrible',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(2);
      expect(result[0].detected_phrase).toBe('clearly');
      expect(result[1].detected_phrase).toBe('terrible');
    });
  });

  describe('Case insensitivity', () => {
    it('should find phrases regardless of case differences', () => {
      const text = 'The POLITICIAN made a statement';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'politician',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'STATEMENT',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(2);
    });

    it('should handle mixed case in both text and phrases', () => {
      const text = 'CleArLy this is a TeSt';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'CLEARLY',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'missing',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].detected_phrase).toBe('CLEARLY');
    });
  });

  describe('Preserving indicators with existing positions', () => {
    it('should always keep indicators that have character_positions', () => {
      const text = 'This is a test';
      const indicators: Array<RawBiasIndicator> = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'elephant',
          character_positions: { start: 0, end: 8 }
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].detected_phrase).toBe('elephant');
    });

    it('should keep indicators with positions even if phrase not in text', () => {
      const text = 'Real content here';
      const indicators: Array<RawBiasIndicator> = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'missing phrase',
          character_positions: { start: 5, end: 12 }
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'another missing',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(1);
      expect(result[0].detected_phrase).toBe('missing phrase');
    });

    it('should mix indicators with and without positions correctly', () => {
      const text = 'This has content';
      const indicators: Array<RawBiasIndicator> = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'content',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'not in text',
          character_positions: { start: 0, end: 11 }
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'missing',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(2);
      expect(result[0].detected_phrase).toBe('content');
      expect(result[1].detected_phrase).toBe('not in text');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty indicators array', () => {
      const text = 'Some text';
      const indicators: RawBiasIndicator[] = [];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle empty text', () => {
      const text = '';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'test',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(0);
    });

    it('should handle empty detected phrase', () => {
      const text = 'Some text';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: '',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(0); // Empty phrases should be filtered out
    });

    it('should handle whitespace-only phrases', () => {
      const text = 'This is a test';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: '   ',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      // Whitespace is technically found in text via includes()
      expect(result).toHaveLength(0); // Should be filtered out as not meaningful
    });
  });

  describe('Multi-word phrases', () => {
    it('should find multi-word phrases', () => {
      const text = 'This is absolutely and completely wrong';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'absolutely and completely',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(1);
    });

    it('should not find partial multi-word matches', () => {
      const text = 'This is absolutely wrong';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'absolutely and completely',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(0);
    });
  });

  describe('Special characters and punctuation', () => {
    it('should find phrases with punctuation', () => {
      const text = 'The cost is $100.00 exactly';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: '$100.00',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(1);
    });

    it('should handle phrases with special characters', () => {
      const text = 'Contact us at user@example.com for help';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'user@example.com',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(1);
    });
  });

  describe('Real-world scenarios', () => {
    it('should filter out phrases from different articles', () => {
      const text = 'The politician clearly failed to address the concerns.';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'clearly',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'absolutely',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'politician',
        }
      ];

      const result = filterIndicatorsInText(indicators, text);

      expect(result).toHaveLength(2);
      expect(result[0].detected_phrase).toBe('clearly');
      expect(result[1].detected_phrase).toBe('politician');
    });
  });

  describe('Integration with addCharacterPositions', () => {
    it('should work as a pre-filter before addCharacterPositions', () => {
      const text = 'This is clearly a problem';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'clearly',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'elephant',
        }
      ];

      // Filter first, then add positions
      const filtered = filterIndicatorsInText(indicators, text);
      const result = addCharacterPositions(filtered, text);

      expect(result).toHaveLength(1);
      expect(result[0].detected_phrase).toBe('clearly');
      expect(result[0].character_positions).toEqual({ start: 8, end: 15 });
    });

    it('should eliminate the need for fallback positions', () => {
      const text = 'Some real text content here';
      const indicators: RawBiasIndicator[] = [
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'real',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'missing',
        },
        {
          bias_indicator_key: 'overgeneralisation',
          detected_phrase: 'absent',
        }
      ];

      const filtered = filterIndicatorsInText(indicators, text);
      const result = addCharacterPositions(filtered, text);

      // Should only have the found indicator, no fallback positions
      expect(result).toHaveLength(1);
      expect(result[0].detected_phrase).toBe('real');
      expect(result[0].character_positions).toEqual({ start: 5, end: 9 });
    });
  });
});

describe('limitIndicatorsByKey', () => {
  describe('Basic functionality', () => {
    it('should limit indicators to 3 per key by default', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase2' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase3' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase4' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase5' },
      ];

      const result = limitIndicatorsByKey(indicators, undefined);

      expect(result).toHaveLength(3);
      expect(result[0].detected_phrase).toBe('phrase1');
      expect(result[1].detected_phrase).toBe('phrase2');
      expect(result[2].detected_phrase).toBe('phrase3');
    });

    it('should respect custom maxPerKey parameter', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'phrase1' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'phrase2' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'phrase3' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'phrase4' },
      ];

      const result = limitIndicatorsByKey(indicators, undefined, 2);

      expect(result).toHaveLength(2);
      expect(result[0].detected_phrase).toBe('phrase1');
      expect(result[1].detected_phrase).toBe('phrase2');
    });

    it('should not reduce indicators when count is below limit', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase2' },
      ];

      const result = limitIndicatorsByKey(indicators, undefined, 3);

      expect(result).toHaveLength(2);
      expect(result).toEqual(indicators);
    });
  });

  describe('Multiple keys', () => {
    it('should limit each key independently', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 's1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's2' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's3' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's4' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p1' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p2' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p3' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p4' },
        { bias_indicator_key: 'overgeneralizations', detected_phrase: 'o1' },
      ];

      const result = limitIndicatorsByKey(indicators, undefined, 3);

      expect(result).toHaveLength(7); // 3 sarcasm + 3 passiveVoice + 1 overgeneralizations
      
      const sarcasmCount = result.filter(i => i.bias_indicator_key === 'sarcasm').length;
      const passiveVoiceCount = result.filter(i => i.bias_indicator_key === 'passiveVoice').length;
      const overgenCount = result.filter(i => i.bias_indicator_key === 'overgeneralizations').length;
      
      expect(sarcasmCount).toBe(3);
      expect(passiveVoiceCount).toBe(3);
      expect(overgenCount).toBe(1);
    });

    it('should preserve the first N occurrences of each key', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'typeA', detected_phrase: 'a1' },
        { bias_indicator_key: 'typeB', detected_phrase: 'b1' },
        { bias_indicator_key: 'typeA', detected_phrase: 'a2' },
        { bias_indicator_key: 'typeB', detected_phrase: 'b2' },
        { bias_indicator_key: 'typeA', detected_phrase: 'a3' },
        { bias_indicator_key: 'typeA', detected_phrase: 'a4' },
      ];

      const result = limitIndicatorsByKey(indicators, undefined, 2);

      expect(result).toHaveLength(4); // 2 typeA + 2 typeB
      
      const typeA = result.filter(i => i.bias_indicator_key === 'typeA');
      const typeB = result.filter(i => i.bias_indicator_key === 'typeB');
      
      expect(typeA[0].detected_phrase).toBe('a1');
      expect(typeA[1].detected_phrase).toBe('a2');
      expect(typeB[0].detected_phrase).toBe('b1');
      expect(typeB[1].detected_phrase).toBe('b2');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty array', () => {
      const indicators: RawBiasIndicator[] = [];
      const result = limitIndicatorsByKey(indicators, undefined, 3);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle single indicator', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase1' },
      ];

      const result = limitIndicatorsByKey(indicators, undefined, 3);

      expect(result).toHaveLength(1);
      expect(result).toEqual(indicators);
    });

    it('should handle maxPerKey of 1', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase2' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'phrase3' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'phrase4' },
      ];

      const result = limitIndicatorsByKey(indicators, undefined, 1);

      expect(result).toHaveLength(2);
      expect(result[0].detected_phrase).toBe('phrase1');
      expect(result[1].detected_phrase).toBe('phrase3');
    });

    it('should handle maxPerKey of 0', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase2' },
      ];

      const result = limitIndicatorsByKey(indicators, undefined, 0);

      expect(result).toHaveLength(0);
    });

    it('should preserve additional properties on indicators', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase1', confidence: '95%' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase2', confidence: '87%' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase3', confidence: '92%' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'phrase4', confidence: '89%' },
      ];

      const result = limitIndicatorsByKey(indicators, undefined, 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ bias_indicator_key: 'sarcasm', detected_phrase: 'phrase1', confidence: '95%' });
      expect(result[1]).toEqual({ bias_indicator_key: 'sarcasm', detected_phrase: 'phrase2', confidence: '87%' });
    });
  });
});

describe('limitSpecificKeys', () => {
  describe('Selective limiting functionality', () => {
    it('should limit only specified keys', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 's1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's2' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's3' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's4' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p1' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p2' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p3' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p4' },
        { bias_indicator_key: 'overgeneralizations', detected_phrase: 'o1' },
        { bias_indicator_key: 'overgeneralizations', detected_phrase: 'o2' },
        { bias_indicator_key: 'overgeneralizations', detected_phrase: 'o3' },
        { bias_indicator_key: 'overgeneralizations', detected_phrase: 'o4' },
      ];

      const result = limitIndicatorsByKey(indicators, ['sarcasm', 'passiveVoice'], 3);

      // Should have 3 sarcasm + 3 passiveVoice + 4 overgeneralizations = 10 total
      expect(result).toHaveLength(10);
      
      const sarcasmCount = result.filter(i => i.bias_indicator_key === 'sarcasm').length;
      const passiveVoiceCount = result.filter(i => i.bias_indicator_key === 'passiveVoice').length;
      const overgenCount = result.filter(i => i.bias_indicator_key === 'overgeneralizations').length;
      
      expect(sarcasmCount).toBe(3);
      expect(passiveVoiceCount).toBe(3);
      expect(overgenCount).toBe(4); // Not limited
    });

    it('should not limit keys not in the keysToLimit array', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 's1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's2' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's3' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's4' },
        { bias_indicator_key: 'other', detected_phrase: 'o1' },
        { bias_indicator_key: 'other', detected_phrase: 'o2' },
        { bias_indicator_key: 'other', detected_phrase: 'o3' },
        { bias_indicator_key: 'other', detected_phrase: 'o4' },
        { bias_indicator_key: 'other', detected_phrase: 'o5' },
      ];

      const result = limitIndicatorsByKey(indicators, ['sarcasm'], 2);

      expect(result).toHaveLength(7); // 2 sarcasm + 5 other
      
      const sarcasmCount = result.filter(i => i.bias_indicator_key === 'sarcasm').length;
      const otherCount = result.filter(i => i.bias_indicator_key === 'other').length;
      
      expect(sarcasmCount).toBe(2);
      expect(otherCount).toBe(5); // All 5 kept
    });

    it('should use default maxPerKey of 3 when limiting specific keys', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 's1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's2' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's3' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's4' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's5' },
      ];

      const result = limitIndicatorsByKey(indicators, ['sarcasm']);

      expect(result).toHaveLength(3);
    });
  });

  describe('Multiple specified keys', () => {
    it('should limit multiple keys independently', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 's1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's2' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's3' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p1' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p2' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'p3' },
      ];

      const result = limitIndicatorsByKey(indicators, ['sarcasm', 'passiveVoice'], 2);

      expect(result).toHaveLength(4); // 2 sarcasm + 2 passiveVoice
      
      const sarcasmCount = result.filter(i => i.bias_indicator_key === 'sarcasm').length;
      const passiveVoiceCount = result.filter(i => i.bias_indicator_key === 'passiveVoice').length;
      
      expect(sarcasmCount).toBe(2);
      expect(passiveVoiceCount).toBe(2);
    });
  });

  describe('Edge cases with selective limiting', () => {
    it('should handle empty indicators array', () => {
      const indicators: RawBiasIndicator[] = [];
      const result = limitIndicatorsByKey(indicators, ['sarcasm'], 3);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle empty keysToLimit array by limiting all keys', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 's1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's2' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's3' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's4' },
      ];

      const result = limitIndicatorsByKey(indicators, [], 2);

      expect(result).toHaveLength(2); // Limited to 2 sarcasm
      expect(result[0].detected_phrase).toBe('s1');
      expect(result[1].detected_phrase).toBe('s2');
    });

    it('should handle keys in keysToLimit that do not exist in indicators', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 's1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's2' },
      ];

      const result = limitIndicatorsByKey(indicators, ['nonexistent', 'alsoNonexistent'], 3);

      expect(result).toHaveLength(2);
      expect(result).toEqual(indicators);
    });

    it('should handle indicators below the limit', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 's1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's2' },
      ];

      const result = limitIndicatorsByKey(indicators, ['sarcasm'], 5);

      expect(result).toHaveLength(2);
      expect(result).toEqual(indicators);
    });

    it('should preserve additional properties on indicators when selectively limiting', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 's1', confidence: '95%' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's2', confidence: '87%' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 's3', confidence: '92%' },
        { bias_indicator_key: 'other', detected_phrase: 'o1', confidence: '80%' },
      ];

      const result = limitIndicatorsByKey(indicators, ['sarcasm'], 2);

      expect(result).toHaveLength(3); // 2 sarcasm + 1 other
      expect(result[0]).toEqual({ bias_indicator_key: 'sarcasm', detected_phrase: 's1', confidence: '95%' });
      expect(result[1]).toEqual({ bias_indicator_key: 'sarcasm', detected_phrase: 's2', confidence: '87%' });
      expect(result[2]).toEqual({ bias_indicator_key: 'other', detected_phrase: 'o1', confidence: '80%' });
    });
  });

  describe('Real-world use case', () => {
    it('should limit sarcasm and passiveVoice as used in biasAnalysis', () => {
      const indicators: RawBiasIndicator[] = [
        { bias_indicator_key: 'sarcasm', detected_phrase: 'sarcastic1' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'sarcastic2' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'sarcastic3' },
        { bias_indicator_key: 'sarcasm', detected_phrase: 'sarcastic4' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'was done' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'was said' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'was made' },
        { bias_indicator_key: 'passiveVoice', detected_phrase: 'was taken' },
        { bias_indicator_key: 'overgeneralizations', detected_phrase: 'always' },
        { bias_indicator_key: 'overgeneralizations', detected_phrase: 'never' },
        { bias_indicator_key: 'overgeneralizations', detected_phrase: 'everyone' },
        { bias_indicator_key: 'overgeneralizations', detected_phrase: 'nobody' },
        { bias_indicator_key: 'emotionallyChargedAdjectives', detected_phrase: 'terrible' },
        { bias_indicator_key: 'emotionallyChargedAdjectives', detected_phrase: 'amazing' },
        { bias_indicator_key: 'emotionallyChargedAdjectives', detected_phrase: 'horrible' },
        { bias_indicator_key: 'emotionallyChargedAdjectives', detected_phrase: 'wonderful' },
      ];

      const result = limitIndicatorsByKey(indicators, ['sarcasm', 'passiveVoice'], 3);

      // Should have: 3 sarcasm + 3 passiveVoice + 4 overgeneralizations + 4 emotionallyChargedAdjectives = 14
      expect(result).toHaveLength(14);
      
      const sarcasmCount = result.filter(i => i.bias_indicator_key === 'sarcasm').length;
      const passiveVoiceCount = result.filter(i => i.bias_indicator_key === 'passiveVoice').length;
      const overgenCount = result.filter(i => i.bias_indicator_key === 'overgeneralizations').length;
      const emotionalCount = result.filter(i => i.bias_indicator_key === 'emotionallyChargedAdjectives').length;
      
      expect(sarcasmCount).toBe(3);
      expect(passiveVoiceCount).toBe(3);
      expect(overgenCount).toBe(4);
      expect(emotionalCount).toBe(4);
    });
  });
});
