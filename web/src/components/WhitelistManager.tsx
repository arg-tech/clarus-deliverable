import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2, ChevronDown } from 'lucide-react';
import { getWhitelistedPhrases, removeWhitelistedPhrase, clearWhitelistedPhrases } from '../services/whitelistStorage';

interface WhitelistManagerProps {
  isOpen: boolean;
  onToggle: () => void;
  onPhraseRemoved: (phrase: string) => void;
  onCleared: () => void;
  phraseCount: number;
  detectedPhrases: Set<string>;
  categoryKeys: string[];
  disabledCategories: Set<string>;
  detectedCategories: Set<string>;
  onDisableCategory: (categoryKey: string) => void;
  onEnableCategory: (categoryKey: string) => void;
  onEnableAllCategories: () => void;
}

type Tab = 'phrases' | 'categories';

export const WhitelistManager = ({
  isOpen,
  onToggle,
  onPhraseRemoved,
  onCleared,
  phraseCount,
  detectedPhrases,
  categoryKeys,
  disabledCategories,
  detectedCategories,
  onDisableCategory,
  onEnableCategory,
  onEnableAllCategories,
}: WhitelistManagerProps) => {
  const { t } = useTranslation();
  const [phrases, setPhrases] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [showOtherCategories, setShowOtherCategories] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('phrases');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPhrases([...getWhitelistedPhrases()].sort());
    } else {
      setShowAll(false);
      setShowOtherCategories(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  const handleRemove = (phrase: string) => {
    removeWhitelistedPhrase(phrase);
    setPhrases(prev => prev.filter(p => p !== phrase));
    onPhraseRemoved(phrase);
  };

  const handleClearAll = () => {
    clearWhitelistedPhrases();
    setPhrases([]);
    onCleared();
  };

  const detectedInText = phrases.filter(p => detectedPhrases.has(p));
  const otherPhrases = phrases.filter(p => !detectedPhrases.has(p));

  const sortedCategoryKeys = useMemo(() => {
    return [...categoryKeys].sort((a, b) => {
      return t(`biasIndicators.cards.${a}.title`).localeCompare(t(`biasIndicators.cards.${b}.title`));
    });
  }, [categoryKeys, t]);

  const detectedCategoryKeys = sortedCategoryKeys.filter(key => detectedCategories.has(key));
  const otherCategoryKeys = sortedCategoryKeys.filter(key => !detectedCategories.has(key));

  const disabledCategoryCount = disabledCategories.size;
  const totalBadgeCount = phraseCount + disabledCategoryCount;

  const renderCategoryItem = (key: string) => {
    const isDisabled = disabledCategories.has(key);
    const label = t(`biasIndicators.cards.${key}.title`);
    return (
      <li key={key} className="whitelist-category-item">
        <div className="whitelist-category-info">
          <span className="whitelist-category-title">{label}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!isDisabled}
          aria-label={t('biasIndicators.toggleCategory', {
            category: label,
            state: isDisabled ? t('biasIndicators.disabled') : t('biasIndicators.enabled'),
          })}
          className={`whitelist-category-toggle ${isDisabled ? 'disabled' : 'enabled'}`}
          onClick={() => (isDisabled ? onEnableCategory(key) : onDisableCategory(key))}
          title={isDisabled ? t('biasIndicators.enableCategory') : t('biasIndicators.disableCategory')}
        >
          <span className="whitelist-category-toggle-track">
            <span className="whitelist-category-toggle-thumb" />
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="whitelist-manager" ref={containerRef}>
      <button
        className="whitelist-trigger"
        onClick={onToggle}
        aria-label={t('whitelist.title')}
        title={t('whitelist.title')}
      >
        <span className="whitelist-trigger-label">{t('whitelist.triggerLabel')}</span>
        {totalBadgeCount > 0 && (
          <span className="whitelist-badge">{totalBadgeCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="whitelist-dropdown">
          <div className="whitelist-dropdown-header">
            <h4 className="whitelist-dropdown-title">{t('whitelist.title')}</h4>
            <button className="whitelist-dropdown-close" onClick={onToggle}>
              <X size={16} />
            </button>
          </div>

          <div className="whitelist-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'phrases'}
              className={`whitelist-tab ${activeTab === 'phrases' ? 'active' : ''}`}
              onClick={() => setActiveTab('phrases')}
            >
              {t('whitelist.tabs.phrases')}
              {phrases.length > 0 && <span className="whitelist-tab-count">{phrases.length}</span>}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'categories'}
              className={`whitelist-tab ${activeTab === 'categories' ? 'active' : ''}`}
              onClick={() => setActiveTab('categories')}
            >
              {t('whitelist.tabs.categories')}
              {disabledCategoryCount > 0 && (
                <span className="whitelist-tab-count">{disabledCategoryCount}</span>
              )}
            </button>
          </div>

          {activeTab === 'phrases' && (
            phrases.length === 0 ? (
              <div className="whitelist-empty">
                <p>{t('whitelist.empty')}</p>
              </div>
            ) : (
              <>
                <div className="whitelist-section">
                  <h5 className="whitelist-section-title">{t('whitelist.detectedInText')}</h5>
                  {detectedInText.length > 0 ? (
                    <ul className="whitelist-phrases">
                      {detectedInText.map(phrase => (
                        <li key={phrase} className="whitelist-phrase-item">
                          <span className="whitelist-phrase-text">{phrase}</span>
                          <button
                            className="whitelist-phrase-remove"
                            onClick={() => handleRemove(phrase)}
                            aria-label={t('whitelist.removeSingle', { phrase })}
                          >
                            <X size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="whitelist-section-empty">{t('whitelist.noDetected')}</p>
                  )}
                </div>

                {otherPhrases.length > 0 && (
                  <div className="whitelist-section">
                    <button
                      className="whitelist-section-toggle"
                      onClick={() => setShowAll(prev => !prev)}
                    >
                      <ChevronDown size={14} className={`whitelist-chevron ${showAll ? 'expanded' : ''}`} />
                      <span className="whitelist-section-title">{t('whitelist.otherIgnored')} ({otherPhrases.length})</span>
                    </button>
                    {showAll && (
                      <ul className="whitelist-phrases">
                        {otherPhrases.map(phrase => (
                          <li key={phrase} className="whitelist-phrase-item">
                            <span className="whitelist-phrase-text">{phrase}</span>
                            <button
                              className="whitelist-phrase-remove"
                              onClick={() => handleRemove(phrase)}
                              aria-label={t('whitelist.removeSingle', { phrase })}
                            >
                              <X size={15} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="whitelist-dropdown-footer">
                  <button className="whitelist-clear-all" onClick={handleClearAll}>
                    <Trash2 size={15} />
                    {t('whitelist.clearAll')}
                  </button>
                </div>
              </>
            )
          )}

          {activeTab === 'categories' && (
            <>
              {detectedCategoryKeys.length > 0 && (
                <div className="whitelist-section">
                  <h5 className="whitelist-section-title">{t('whitelist.categories.detectedSection')}</h5>
                  <ul className="whitelist-category-list">
                    {detectedCategoryKeys.map(renderCategoryItem)}
                  </ul>
                </div>
              )}

              {otherCategoryKeys.length > 0 && (
                <div className="whitelist-section">
                  <button
                    className="whitelist-section-toggle"
                    onClick={() => setShowOtherCategories(prev => !prev)}
                  >
                    <ChevronDown
                      size={14}
                      className={`whitelist-chevron ${showOtherCategories ? 'expanded' : ''}`}
                    />
                    <span className="whitelist-section-title">
                      {t('whitelist.categories.otherSection')} ({otherCategoryKeys.length})
                    </span>
                  </button>
                  {showOtherCategories && (
                    <ul className="whitelist-category-list">
                      {otherCategoryKeys.map(renderCategoryItem)}
                    </ul>
                  )}
                </div>
              )}

              {detectedCategoryKeys.length === 0 && otherCategoryKeys.length === 0 && (
                <div className="whitelist-empty">
                  <p>{t('whitelist.categories.empty')}</p>
                </div>
              )}

              {disabledCategoryCount > 0 && (
                <div className="whitelist-dropdown-footer">
                  <button className="whitelist-clear-all" onClick={onEnableAllCategories}>
                    <Trash2 size={15} />
                    {t('whitelist.clearAllCategories')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
