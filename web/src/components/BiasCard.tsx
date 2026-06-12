import { useTranslation } from 'react-i18next';
import { useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import type { BiasIndicator } from '../types';

const HOVER_PREVIEW_DELAY_MS = 250;

interface BiasCardProps {
  indicator: BiasIndicator;
  onClick?: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onDismiss?: (indicator: BiasIndicator) => void;
  categoryDisabled?: boolean;
  isHighlighted?: boolean;
}

export const BiasCard = ({ indicator, onClick, onHoverStart, onHoverEnd, onDismiss, categoryDisabled = false, isHighlighted }: BiasCardProps) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverPreviewTimeout = () => {
    if (hoverPreviewTimeoutRef.current !== null) {
      clearTimeout(hoverPreviewTimeoutRef.current);
      hoverPreviewTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [isHighlighted]);

  useEffect(() => clearHoverPreviewTimeout, []);

  const clearHighlightedMarkers = () => {
    const markers = document.querySelectorAll('.bias-indicator-marker.highlighted');
    markers.forEach((marker) => {
      marker.classList.remove('highlighted');
    });
  };

  const highlightMatchingMarkers = () => {
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

  const handleDismissClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDismiss) {
      onDismiss(indicator);
    }
  };

  const handleMouseEnter = () => {
    highlightMatchingMarkers();
    clearHoverPreviewTimeout();
    hoverPreviewTimeoutRef.current = setTimeout(() => {
      onHoverStart?.();
      hoverPreviewTimeoutRef.current = null;
    }, HOVER_PREVIEW_DELAY_MS);
  };

  const handleMouseLeave = () => {
    clearHoverPreviewTimeout();
    clearHighlightedMarkers();
    onHoverEnd?.();
  };

  const handleFocus = () => {
    clearHoverPreviewTimeout();
    highlightMatchingMarkers();
    onHoverStart?.();
  };

  const handleBlur = () => {
    clearHoverPreviewTimeout();
    clearHighlightedMarkers();
    onHoverEnd?.();
  };

  const handleClick = () => {
    clearHoverPreviewTimeout();
    onClick?.();
  };

  return (
    <div
      ref={cardRef}
      className={`bias-card ${indicator.outdated ? 'outdated' : ''} ${indicator.categoryDisabled ? 'category-disabled' : ''} ${isHighlighted ? 'highlighted' : ''}`}
      tabIndex={0}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
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

      {!indicator.outdated && !categoryDisabled && onDismiss && (
        <div className="bias-card-actions">
          <button
            className="bias-card-dismiss-button"
            onClick={handleDismissClick}
          >
            <Trash2 size={14} /> {t('biasIndicators.dismiss')}
          </button>
        </div>
      )}
    </div>
  );
};
