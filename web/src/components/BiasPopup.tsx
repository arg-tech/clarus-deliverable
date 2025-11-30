import { useTranslation } from 'react-i18next';
import type { BiasIndicator } from '../types';

interface BiasPopupProps {
  indicator: BiasIndicator;
  position: { x: number; y: number };
}

export const BiasPopup = ({ indicator, position }: BiasPopupProps) => {
  const { t } = useTranslation();
  return (
    <div 
      className="bias-popup"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
    >
      <div className="bias-popup-content">
        <div className="bias-popup-header">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="bias-popup-icon">⚠️</span>
          <h4 className="bias-popup-title">{t(`biasIndicators.cards.${indicator.bias_indicator_key}.title`)}</h4>
        </div>
        
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
        </div>
      </div>
    </div>
  );
};
