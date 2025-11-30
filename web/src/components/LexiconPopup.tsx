import { useTranslation } from 'react-i18next';
import type { LexiconTerm } from '../types';

interface LexiconPopupProps {
  term: LexiconTerm;
  position: { x: number; y: number };
}

export const LexiconPopup = ({ term, position }: LexiconPopupProps) => {
  const { t } = useTranslation();
  return (
    <div 
      className="bias-popup lexicon-popup"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
    >
      <div className="bias-popup-content">
        <div className="bias-popup-header lexicon-popup-header">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="bias-popup-icon">📘</span>
          <h4 className="bias-popup-title">{t('lexicon.popup.title', 'Lexicon term')}</h4>
        </div>
        
        <div className="bias-popup-body">
          <div className="bias-popup-section lexicon-phrase-section">
            <strong className="bias-popup-label">{t('lexicon.popup.detectedPhrase', 'Detected lexicon phrase:')}</strong>
            <span className="bias-popup-phrase">{term.word}</span>
          </div>
          
          {term.definition && (
            <div className="bias-popup-section">
              <strong className="bias-popup-label">{t('lexicon.popup.definition', 'Definition:')}</strong>
              <p className="bias-popup-explanation">{term.definition}</p>
            </div>
          )}
          
          <div className="bias-popup-section">
            <strong className="bias-popup-label">{t('lexicon.popup.usageExample', 'Usage example:')}</strong>
            <p className="bias-popup-explanation">{term.usage_example}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
