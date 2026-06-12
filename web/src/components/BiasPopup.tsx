import { useTranslation } from 'react-i18next';
import { useRef, useLayoutEffect, useState } from 'react';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { BiasIndicator } from '../types';

interface BiasPopupProps {
  indicators: BiasIndicator[];
  activeIndex: number;
  position: { x: number; y: number };
  onDismiss?: (indicator: BiasIndicator) => void;
  onNavigate?: (newIndex: number) => void;
}

export const BiasPopup = ({ indicators, activeIndex, position, onDismiss, onNavigate }: BiasPopupProps) => {
  const { t } = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);
  const indicator = indicators[activeIndex];

  useLayoutEffect(() => {
    if (!popupRef.current) {
      setAdjustedPos(position);
      return;
    }
    const rect = popupRef.current.getBoundingClientRect();
    const padding = 10;
    let { x, y } = position;

    // Adjust horizontally
    if (x + rect.width > window.innerWidth - padding) {
      x = window.innerWidth - rect.width - padding;
    }
    if (x < padding) x = padding;

    // Adjust vertically — flip above if overflowing bottom
    if (y + rect.height > window.innerHeight - padding) {
      y = position.y - rect.height - 10;
    }
    // If still off-screen at top, clamp to top
    if (y < padding) y = padding;

    setAdjustedPos({ x, y });
  }, [position, activeIndex]);

  if (!indicator) return null;

  return (
    <div
      ref={popupRef}
      className="bias-popup"
      style={{
        position: 'fixed',
        left: adjustedPos.x,
        top: adjustedPos.y,
        zIndex: 1000,
      }}
    >
      <div className="bias-popup-content">
        <div className="bias-popup-header">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="bias-popup-icon">⚠️</span>
          <h4 className="bias-popup-title">{t(`biasIndicators.cards.${indicator.bias_indicator_key}.title`)}</h4>
        </div>

        {indicators.length > 1 && (
          <div className="bias-popup-nav">
            <button
              className="bias-popup-nav-button"
              disabled={activeIndex === 0}
              onClick={() => onNavigate?.(activeIndex - 1)}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="bias-popup-nav-counter">{activeIndex + 1} / {indicators.length}</span>
            <button
              className="bias-popup-nav-button"
              disabled={activeIndex === indicators.length - 1}
              onClick={() => onNavigate?.(activeIndex + 1)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div className="bias-popup-body">
          <div className="bias-popup-section">
            <strong className="bias-popup-label">{t('biasIndicators.popup.detectedPhrase')}</strong>
            <span className="bias-popup-phrase">"{indicator.detected_phrase}"</span>
          </div>

          <div className="bias-popup-section">
            <strong className="bias-popup-label">{t('biasIndicators.popup.whyThisMatters')}</strong>
            <p className="bias-popup-explanation">{t(`biasIndicators.cards.${indicator.bias_indicator_key}.explanation`, {phrase: indicator.detected_phrase, confidence: indicator.confidence})}</p>
          </div>

          <div className="bias-popup-section bias-popup-fix">
            <strong className="bias-popup-label">{t('biasIndicators.popup.suggestedImprovement')}</strong>
            <p className="bias-popup-suggestion">{t(`biasIndicators.cards.${indicator.bias_indicator_key}.suggestedFix`)}</p>
          </div>

          {indicator.categoryDisabled && (
            <div className="bias-popup-section">
              <strong className="bias-popup-label">{t('biasIndicators.popup.status')}</strong>
              <p className="bias-popup-explanation">{t('biasIndicators.popup.categoryDisabled')}</p>
            </div>
          )}

          {!indicator.categoryDisabled && onDismiss && (
            <div className="bias-popup-actions">
              <button
                className="bias-popup-dismiss-button"
                onClick={() => onDismiss(indicator)}
              >
                <Trash2 size={14} /> {t('biasIndicators.dismiss')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
