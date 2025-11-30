import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SentimentChart from '../SentimentChart';
import type { SentimentResult } from '../../services/sentimentAnalysis';

interface SentimentCardProps {
  sentimentResults: SentimentResult[];
}

const SentimentCard: React.FC<SentimentCardProps> = ({ sentimentResults }) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  if (!sentimentResults || sentimentResults.length === 0) {
    return null;
  }

  const getSentimentScore = (sentiment: string): number => {
    const lowerSentiment = sentiment.toLowerCase();
    if (lowerSentiment === 'very positive') return 2;
    if (lowerSentiment === 'positive') return 1;
    if (lowerSentiment === 'neutral') return 0;
    if (lowerSentiment === 'negative') return -1;
    if (lowerSentiment === 'very negative') return -2;
    return 0;
  };

  // Analyze sentiment trends and generate a conclusion
  // Todo: move conclusion logic to backend
  const getConclusion = (): string | null => {
    // Calculate trajectory of sentiment
    const { m: slope } = calculateLinearRegression(
    sentimentResults, 
    getSentimentScore
);

    if (slope > 0.05) {
        return t('sentiment.conclusions.positiveTrajectory');
    } else if (slope < -0.05) { 
        return t('sentiment.conclusions.negativeTrajectory');
    }

    // Calculate mean sentiment of entire text
    const meanSentiment = sentimentResults.reduce(
      (sum, result) => sum + getSentimentScore(result.sentiment), 
      0
    ) / sentimentResults.length;

    if (meanSentiment >= 1.5) {
      return t('sentiment.conclusions.veryPositive');
    }
    if (meanSentiment <= -1.5) {
      return t('sentiment.conclusions.veryNegative');
    }
    
    if (meanSentiment >= 1.0) {
      return t('sentiment.conclusions.leansPositive');
    }
    if (meanSentiment <= -1.0) {
      return t('sentiment.conclusions.leansNegative');
    }
    if (Math.abs(meanSentiment) < 0.5) {
      return t('sentiment.conclusions.balanced');
    }

    return t('sentiment.conclusions.noIssues');
  };

  /**
 * Performs Simple Linear Regression on a set of (x, y) data points.
 * @param sentimentResults - Array of objects, each containing a sentiment score.
 * @param getSentimentScore - Function to extract the weighted score from a result object.
 * @returns Object with m: slope, b: y-intercept
 */
  const calculateLinearRegression = (
    sentimentResults: SentimentResult[], 
    getSentimentScore: (sentiment: string) => number
  ): { m: number; b: number } => {
    const N = sentimentResults.length;
    if (N < 2) {
        return { m: 0, b: getSentimentScore(sentimentResults[0].sentiment) * sentimentResults[0].confidence || 0 };
    }

    let sumX = 0;       // Sum of all x values (sentence index)
    let sumY = 0;       // Sum of all y values (sentiment score)
    let sumXY = 0;      // Sum of (x * y)
    let sumX2 = 0;      // Sum of (x * x)

    for (let i = 0; i < N; i++) {
        const x = i;
        const y = getSentimentScore(sentimentResults[i].sentiment) * sentimentResults[i].confidence;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    }

    const meanX = sumX / N;
    const meanY = sumY / N;
    const numerator = (N * sumXY) - (sumX * sumY);
    const denominator = (N * sumX2) - (sumX * sumX);

    const slope = (denominator === 0) ? 0 : numerator / denominator;
    const intercept = meanY - slope * meanX;

    return { m: slope, b: intercept };
  };

  const conclusion = getConclusion();

  return (
    <div className="sentiment-card">
      <div className="sentiment-header">
        <h3>{t('sentiment.title')}</h3>
        <button 
          className="details-toggle-button" 
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? t('sentiment.hideDetails') : t('sentiment.showDetails')}
        </button>
      </div>
      
      <div className="sentiment-chart-wrapper">
        <SentimentChart sentimentResults={sentimentResults} />
      </div>
      
      {showDetails && (
        <div className="sentiment-details">
          <h4>{t('sentiment.sentenceDetails')}</h4>
          <ul className="sentiment-list">
            {sentimentResults.map((result, index) => (
              <li key={index} className={`sentiment-item sentiment-${result.sentiment.toLowerCase().replace(' ', '-')}`}>
                <div className="sentiment-sentence">{result.sentence}</div>
                <div className="sentiment-info">
                  <span className="sentiment-label">{t(`sentiment.labels.${getSentimentScore(result.sentiment)}`)}</span>
                  <span className="sentiment-confidence">
                    {(result.confidence * 100).toFixed(1)}% {t('sentiment.confidence')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {conclusion && (
        <div className="sentiment-conclusions">
          <h4>{t('sentiment.sentimentInsight')}</h4>
          <div className="conclusion-item">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="conclusion-icon">ℹ️</span>
            <span className="conclusion-text">{conclusion}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SentimentCard;
