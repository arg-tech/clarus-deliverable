import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LoadingOverlayProps {
  isLoading: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading }) => {
  const { t } = useTranslation();
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);

  const loadingPhrases = [
    t('loadingPhrases.analyzingBias'),
    t('loadingPhrases.checkingLLM'),
    t('loadingPhrases.evaluatingSentiment'),
    t('loadingPhrases.analyzingEntities'),
    t('loadingPhrases.analyzingStructure'),
    t('loadingPhrases.lookingForDisparity'),
    t('loadingPhrases.lookingForPatterns'),
  ];

  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setCurrentPhraseIndex((prev) => (prev + 1) % loadingPhrases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoading, loadingPhrases.length]);

  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loader"></div>
        <div className="loading-text">{loadingPhrases[currentPhraseIndex]}</div>
      </div>
    </div>
  );
};

export default LoadingOverlay;