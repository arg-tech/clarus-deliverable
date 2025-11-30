/**
 * Represents a bias indicator as received from the backend services
 * This matches the BiasIndicatorResult from the Python backend
 */
export interface RawBiasIndicator {
  bias_indicator_key: string;
  detected_phrase: string;
  character_positions?: {
    start: number;
    end: number;
  };
  confidence?: string;
}

/**
 * Represents a bias indicator that has been processed by the frontend
 * All indicators have character_positions after being processed by addCharacterPositions
 */
export interface BiasIndicator extends RawBiasIndicator {
  character_positions: {
    start: number;
    end: number;
  };
  /**
   * The display index for this indicator. 
   * This is used to keep consistent numbering even when some indicators are removed.
   * When an indicator is removed, other indicators keep their original displayIndex values.
   */
  displayIndex?: number;
  /**
   * Indicates if this bias indicator has been edited by the user and is no longer
   * visible in the editor, but is still kept in the list for reference.
   */
  outdated?: boolean;
}

/**
 * Represents a lexicon term as received from the backend
 */
export interface LexiconTerm {
  word: string;
  definition: string;
  usage_example: string;
  character_positions: {
    start: number;
    end: number;
  };
  /**
   * The display index for this term. 
   * This is used to keep consistent numbering even when some terms are removed.
   */
  displayIndex?: number;
  /**
   * Indicates if this lexicon term has been edited by the user and is no longer
   * visible in the editor, but is still kept in the list for reference.
   */
  outdated?: boolean;
}
