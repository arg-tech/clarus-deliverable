import { useTranslation } from 'react-i18next';
import type { LexiconTerm } from '../types';

interface LexiconCardProps {
  term: LexiconTerm;
  onClick?: () => void;
}

export const LexiconCard = ({ term, onClick }: LexiconCardProps) => {
  const { t } = useTranslation();
  return (
    <div className={`lexicon-card ${term.outdated ? 'outdated' : ''}`} onClick={onClick}>
      {term.outdated && (
        <span className="lexicon-card-outdated-badge">{t('lexicon.outdated', 'Outdated')}</span>
      )}
      <div className="lexicon-card-header">
        <span className="lexicon-card-icon">{term.displayIndex || ''}</span>
        <h4 className="lexicon-card-title">{term.word}</h4>
      </div>
      
      <div className="lexicon-card-body">
        <div className="lexicon-card-section">
          <strong className="lexicon-card-label">{t('lexicon.usageExample', 'Usage example')}:</strong>
          <p className="lexicon-card-usage">{term.usage_example}</p>
        </div>
      </div>
    </div>
  );
};
