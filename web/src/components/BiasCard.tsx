import { useTranslation } from 'react-i18next';
import { useRef, useEffect } from 'react';
import type { BiasIndicator } from '../types';

interface BiasCardProps {
  indicator: BiasIndicator;
  onClick?: () => void;
  onMarkOutdated?: (indicator: BiasIndicator) => void;
  isHighlighted?: boolean;
}

export const BiasCard = ({ indicator, onClick, onMarkOutdated, isHighlighted }: BiasCardProps) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      const container = cardRef.current.closest('.bias-cards-container');
      if (container) {
        const cardRect = cardRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Check if card is outside the visible area of the container
        if (cardRect.top < containerRect.top || cardRect.bottom > containerRect.bottom) {
          // Scroll within the container
          const scrollTop = cardRef.current.offsetTop - container.clientHeight / 2 + cardRef.current.clientHeight / 2;
          container.scrollTo({ top: scrollTop, behavior: 'smooth' });
        }
      }
    }
  }, [isHighlighted]);
  
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering onClick
    if (onMarkOutdated) {
      onMarkOutdated(indicator);
    }
  };

  const handleMouseEnter = () => {
    // Find and highlight the marker with matching displayIndex
    if (indicator.displayIndex === undefined) return;
    
    const markers = document.querySelectorAll('.bias-indicator-marker');
    markers.forEach((marker) => {
      const markerElement = marker as HTMLElement;
      const markerIndex = markerElement.dataset.index;
      
      if (markerIndex && parseInt(markerIndex, 10) === indicator.displayIndex) {
        markerElement.classList.add('highlighted');
      }
    });
  };

  const handleMouseLeave = () => {
    // Remove highlight from all markers
    const markers = document.querySelectorAll('.bias-indicator-marker.highlighted');
    markers.forEach((marker) => {
      marker.classList.remove('highlighted');
    });
  };
  
  return (
    <div 
      ref={cardRef} 
      className={`bias-card ${indicator.outdated ? 'outdated' : ''} ${isHighlighted ? 'highlighted' : ''}`} 
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
    {indicator.outdated && (
        <span className="bias-card-outdated-badge">{t('biasIndicators.outdated')}</span>
    )}
      {!indicator.outdated && onMarkOutdated && (
        <button 
          className="bias-card-remove-button" 
          onClick={handleRemoveClick}
          title={t('biasIndicators.markAsOutdated', 'Mark as outdated')}
        >
          ×
        </button>
      )}
      <div className="bias-card-header">
        <span className="bias-card-icon">{indicator.displayIndex || ''}</span>
        <h4 className="bias-card-title">{t(`biasIndicators.cards.${indicator.bias_indicator_key}.title`)}</h4>
      </div>
      
      <div className="bias-card-body">
        <div className="bias-card-section">
          <strong className="bias-card-label">{t('biasIndicators.detectedPhrase')}:</strong>
          <span className="bias-card-phrase">"{indicator.detected_phrase}"</span>
        </div>
        
        <div className="bias-card-section">
          <p className="bias-card-explanation">{t(`biasIndicators.cards.${indicator.bias_indicator_key}.explanation`, {phrase: indicator.detected_phrase, confidence: indicator.confidence})}</p>
        </div>
      </div>
    </div>
  );
};
