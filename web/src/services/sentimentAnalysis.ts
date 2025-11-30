/**
 * Interface for a sentiment result from the sentiment service
 */
export interface SentimentResult {
  sentence: string;
  sentiment: string;  // 'positive', 'negative', or 'neutral'
  confidence: number;
}

/**
 * Analyzes text for sentiment using the get-sentiment endpoint
 * @param text The raw text to analyze
 * @param language The language code (default: 'en')
 * @returns Promise resolving to the sentiment analysis results
 */
export const analyzeSentiment = async (text: string, language: string = 'en'): Promise<SentimentResult[]> => {
  try {
    const response = await fetch('/api/get-sentiment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, language }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const sentimentData = await response.json();
    console.log('Sentiment Analysis Results:', sentimentData);
    return sentimentData;
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    throw error;
  }
};
