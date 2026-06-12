import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BiasCard } from './BiasCard';
import type { BiasIndicator } from '../types';

interface BiasCardGroupProps {
  categoryKey: string;
  indicators: BiasIndicator[];
  onDismiss: (indicator: BiasIndicator) => void;
  onDisableCategory: (categoryKey: string) => void;
  onEnableCategory: (categoryKey: string) => void;
  hoveredIndicator: BiasIndicator | null;
  onCardClick?: (indicator: BiasIndicator) => void;
  onCardHoverStart?: (indicator: BiasIndicator) => void;
  onCardHoverEnd?: () => void;
}

export const BiasCardGroup = ({
  categoryKey,
  indicators,
  onDismiss,
  onDisableCategory,
  onEnableCategory,
  hoveredIndicator,
  onCardClick,
  onCardHoverStart,
  onCardHoverEnd,
}: BiasCardGroupProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  const activeCount = indicators.filter(i => !i.outdated && !i.categoryDisabled).length;
  const disabledCount = indicators.filter(i => i.categoryDisabled).length;
  const categoryDisabled = disabledCount > 0;

  // Auto-expand when a hovered indicator matches this group
  useEffect(() => {
    if (
      hoveredIndicator &&
      indicators.some(
        i => i.displayIndex !== undefined && i.displayIndex === hoveredIndicator.displayIndex
      )
    ) {
      setIsExpanded(true);
    }
  }, [hoveredIndicator, indicators]);

  const handleCategoryToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (categoryDisabled) {
      onEnableCategory(categoryKey);
      return;
    }

    onDisableCategory(categoryKey);
  };

  return (
    <div className="bias-card-group">
      <div
        className={`bias-card-group-header ${categoryDisabled ? 'category-disabled' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={`bias-card-group-chevron ${isExpanded ? 'expanded' : ''}`}>
          &#9654;
        </span>
        <span className="bias-card-group-title">
          {t(`biasIndicators.cards.${categoryKey}.title`)}
        </span>
        {!categoryDisabled && <span className="bias-card-group-count">{activeCount}</span>}
        {categoryDisabled && (
          <span className="bias-card-group-status">{t('biasIndicators.categoryDisabled')}</span>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={!categoryDisabled}
          aria-label={t('biasIndicators.toggleCategory', {
            category: t(`biasIndicators.cards.${categoryKey}.title`),
            state: categoryDisabled ? t('biasIndicators.disabled') : t('biasIndicators.enabled'),
          })}
          className={`bias-category-toggle ${categoryDisabled ? 'disabled' : 'enabled'}`}
          onClick={handleCategoryToggle}
          title={categoryDisabled ? t('biasIndicators.enableCategory') : t('biasIndicators.disableCategory')}
        >
          <span className="bias-category-toggle-track">
            <span className="bias-category-toggle-thumb" />
          </span>
          <span className="bias-category-toggle-label">
            {categoryDisabled ? t('biasIndicators.disabled') : t('biasIndicators.enabled')}
          </span>
        </button>
      </div>
      {isExpanded && (
        <div className="bias-card-group-body">
          {indicators.map((indicator, index) => (
            <BiasCard
              key={`${indicator.bias_indicator_key}-${index}`}
              indicator={indicator}
              onClick={() => onCardClick?.(indicator)}
              onHoverStart={() => onCardHoverStart?.(indicator)}
              onHoverEnd={onCardHoverEnd}
              onDismiss={onDismiss}
              categoryDisabled={categoryDisabled}
              isHighlighted={
                hoveredIndicator !== null &&
                hoveredIndicator.displayIndex !== undefined &&
                hoveredIndicator.displayIndex === indicator.displayIndex
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
