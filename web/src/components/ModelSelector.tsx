import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from './Dropdown';
import './ModelSelector.css';

interface ModelSelectorProps {
  selectedModel: 'local' | 'remote';
  onModelChange: (model: 'local' | 'remote') => void;
}

export const ModelSelector = ({ selectedModel, onModelChange }: ModelSelectorProps) => {
  const { t } = useTranslation();
  const [isTooltipDismissed, setIsTooltipDismissed] = useState(false);

  const models = [
    { value: 'local' as const, label: t('model.local') },
    { value: 'remote' as const, label: t('model.remote') },
  ];

  return (
    <div className="model-selector-wrapper">
      <Dropdown options={models} selectedValue={selectedModel} onChange={onModelChange} label={t('model.label', 'Model:')} />
      {selectedModel === 'remote' && !isTooltipDismissed && (
        <div className="model-warning-tooltip">
          {t('model.remoteWarning', 'Remote models may send your data to remote servers')}
          <button 
            className="tooltip-close-button"
            onClick={() => setIsTooltipDismissed(true)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
