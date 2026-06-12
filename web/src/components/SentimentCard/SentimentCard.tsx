import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import SentimentChart from '../SentimentChart';
import type { SentimentResult } from '../../services/sentimentAnalysis';

interface SentimentCardProps {
  sentimentResults: SentimentResult[];
}

const SentimentCard: React.FC<SentimentCardProps> = ({ sentimentResults }) => {
  const { t } = useTranslation();
  const [isChartExpanded, setIsChartExpanded] = useState(false);

  if (!sentimentResults || sentimentResults.length === 0) {
    return null;
  }

  const getSentimentScore = (sentiment: string): number => {
    const lowerSentiment = sentiment.toLowerCase();
    if (lowerSentiment === 'positive') return 1;
    if (lowerSentiment === 'neutral') return 0;
    if (lowerSentiment === 'negative') return -1;
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

    if (slope < -0.125) {
      return t('sentiment.conclusions.negativeTrajectory');
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
      {conclusion && (
        <div className="sentiment-conclusions">
          <div className="conclusion-item">
            <Info className="conclusion-icon" size={18} />
            <span className="conclusion-text">{conclusion}</span>
          </div>
        </div>
      )}

      <div className="sentiment-chart-wrapper">
        <SentimentChart sentimentResults={sentimentResults} />
        <button
          className="chart-expand-button"
          onClick={() => setIsChartExpanded(true)}
          aria-label={t('sentiment.expandChart', 'Expand chart')}
        >
          <span>⛶</span>
        </button>
      </div>

      {isChartExpanded && createPortal(
        <div
          className="sentiment-chart-modal-overlay"
          onClick={() => setIsChartExpanded(false)}
        >
          <div
            className="sentiment-chart-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="sentiment-chart-modal-close"
              onClick={() => setIsChartExpanded(false)}
              aria-label={t('sentiment.closeChart', 'Close chart')}
            >
              ✕
            </button>
            <SentimentChart sentimentResults={sentimentResults} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SentimentCard;
