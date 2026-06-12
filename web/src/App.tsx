import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { X } from 'lucide-react';
import { TextEditor, BiasPopup, LexiconPopup, BiasCardGroup, LexiconCard, SentimentCard, LoadingOverlay, LanguageSelector, ModelSelector, PdfUploadButton, ThemeToggle, WhitelistManager, AboutModal, TutorialModal, checkShouldShowTutorial } from './components';
import { analyzeBiasIndicators } from './services/biasAnalysis';
import { analyzeSentiment } from './services/sentimentAnalysis';
import { analyzeLLMIndicators } from './services/llmAnalysis';
import { analyzeLexiconTerms } from './services/lexiconAnalysis';
import type { BiasIndicator, LexiconTerm } from './types';
import type { SentimentResult } from './services/sentimentAnalysis';
import { addDismissedCategory, removeDismissedCategory, getDismissedCategories, clearDismissedCategories } from './services/dismissalStorage';
import { getWhitelistedPhrases, addWhitelistedPhrase } from './services/whitelistStorage';
import i18n from './i18n';
import { biasHoverPluginKey } from './extensions/BiasHoverPlugin';
import { clearDismissTimeout, cleanupPopupListener } from './extensions/biasHoverState';
import { franc } from 'franc';
import clarusLogo from './assets/clarus-logo.png';
import euLogo from './assets/eu-logo.png';
import ukriLogo from './assets/ukri-logo.png';
import './App.css';
import { usePdfUpload } from './hooks/usePdfUpload';

const isIndicatorActive = (indicator: BiasIndicator) => !indicator.outdated && !indicator.categoryDisabled;

const applyCategoryState = (indicator: BiasIndicator, disabledCategories: Set<string>): BiasIndicator => {
  const isDisabled = disabledCategories.has(indicator.bias_indicator_key);
  return indicator.categoryDisabled === isDisabled ? indicator : { ...indicator, categoryDisabled: isDisabled };
};

const getAllCategoryKeys = (): string[] => {
  const bundle = i18n.getResourceBundle('en', 'translation') as
    | { biasIndicators?: { cards?: Record<string, unknown> } }
    | undefined;
  const cards = bundle?.biasIndicators?.cards;
  return cards ? Object.keys(cards) : [];
};

function App() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalysed, setIsAnalysed] = useState(false);
  const [hoveredIndicators, setHoveredIndicators] = useState<BiasIndicator[]>([]);
  const [activeIndicatorIndex, setActiveIndicatorIndex] = useState(0);
  const [hoveredLexiconTerm, setHoveredLexiconTerm] = useState<LexiconTerm | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [lexiconPopupPosition, setLexiconPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [biasIndicators, setBiasIndicators] = useState<BiasIndicator[]>([]);
  const [lexiconTerms, setLexiconTerms] = useState<LexiconTerm[]>([]);
  const [sentimentResults, setSentimentResults] = useState<SentimentResult[]>([]);
  const [isSentimentLoading, setIsSentimentLoading] = useState(false);
  const [detectedLanguageCode, setDetectedLanguageCode] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<'local' | 'remote'>('local');
  const [modelUsed, setModelUsed] = useState<string>('');
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [activeTab, setActiveTab] = useState<'bias' | 'lexicon' | 'sentiment'>('bias');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWhitelistOpen, setIsWhitelistOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(() => checkShouldShowTutorial());
  const [detectedWhitelistPhrases, setDetectedWhitelistPhrases] = useState<Set<string>>(new Set());
  const [disabledCategories, setDisabledCategories] = useState<Set<string>>(() => getDismissedCategories());
  const categoryKeys = useMemo(() => getAllCategoryKeys(), []);

  const handleHover = useCallback((indicators: BiasIndicator[], position: { x: number; y: number } | null) => {
    setHoveredIndicators(indicators);
    setActiveIndicatorIndex(0);
    setPopupPosition(position);
  }, []);

  const handlePopupNavigate = useCallback((newIndex: number) => {
    setActiveIndicatorIndex(newIndex);
    setHoveredIndicators(prev => {
      const indicator = prev[newIndex];
      if (editor && indicator) {
        editor.view.dispatch(
          editor.state.tr.setMeta(biasHoverPluginKey, {
            add: {
              from: indicator.character_positions.start,
              to: indicator.character_positions.end,
            },
          })
        );
      }
      return prev;
    });
  }, [editor]);

  const clearBiasPopup = useCallback(() => {
    clearDismissTimeout();
    cleanupPopupListener();
    setHoveredIndicators([]);
    setActiveIndicatorIndex(0);
    setPopupPosition(null);
  }, []);

  const scrollIndicatorIntoView = useCallback((indicator: BiasIndicator) => {
    if (!editor) return;

    const { start, end } = indicator.character_positions;

    try {
      const coords = editor.view.coordsAtPos(start);
      const scrollContainer = editor.view.dom.closest('.editor-content-shell');
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        if (coords.top < containerRect.top || coords.bottom > containerRect.bottom) {
          const targetScrollTop = scrollContainer.scrollTop + (coords.top - containerRect.top) - containerRect.height / 3;
          scrollContainer.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        }
      }
    } catch {
      // Position may be out of range — ignore scroll errors
    }

    return { start, end };
  }, [editor]);

  const previewIndicator = useCallback((indicator: BiasIndicator) => {
    if (!editor) return;

    clearBiasPopup();
    const positions = scrollIndicatorIntoView(indicator);

    if (!positions) return;

    editor.view.dispatch(
      editor.state.tr.setMeta(biasHoverPluginKey, {
        add: { from: positions.start, to: positions.end },
      })
    );
  }, [clearBiasPopup, editor, scrollIndicatorIntoView]);

  const clearIndicatorPreview = useCallback(() => {
    if (!editor) return;

    clearBiasPopup();
    editor.view.dispatch(
      editor.state.tr.setMeta(biasHoverPluginKey, { remove: true })
    );
  }, [clearBiasPopup, editor]);

  const handleCardClick = useCallback((indicator: BiasIndicator) => {
    previewIndicator(indicator);
  }, [previewIndicator]);
  const currentHoveredIndicator = hoveredIndicators[activeIndicatorIndex] ?? null;

  const handleLexiconHover = (term: LexiconTerm | null, position: { x: number; y: number } | null) => {
    setHoveredLexiconTerm(term);
    setLexiconPopupPosition(position);
  };

  const handleDisableCategory = (categoryKey: string) => {
    addDismissedCategory(categoryKey);
    setDisabledCategories(prev => {
      const next = new Set(prev);
      next.add(categoryKey);
      return next;
    });

    if (!editor) return;

    const currentIndicators = editor.storage.biasDecorations?.indicators || [];
    const updatedIndicators = currentIndicators.map((ind: BiasIndicator) =>
      ind.bias_indicator_key === categoryKey ? { ...ind, categoryDisabled: true } : ind
    );

    editor.commands.setBiasIndicators(updatedIndicators, false);
  };

  const handleEnableCategory = (categoryKey: string) => {
    removeDismissedCategory(categoryKey);
    setDisabledCategories(prev => {
      if (!prev.has(categoryKey)) return prev;
      const next = new Set(prev);
      next.delete(categoryKey);
      return next;
    });

    if (!editor) return;

    const currentIndicators = editor.storage.biasDecorations?.indicators || [];
    const updatedIndicators = currentIndicators.map((ind: BiasIndicator) =>
      ind.bias_indicator_key === categoryKey ? { ...ind, categoryDisabled: false } : ind
    );

    editor.commands.setBiasIndicators(updatedIndicators, false);
  };

  const handleEnableAllCategories = () => {
    clearDismissedCategories();
    setDisabledCategories(new Set());

    if (!editor) return;

    const currentIndicators: BiasIndicator[] = editor.storage.biasDecorations?.indicators || [];
    const updatedIndicators = currentIndicators.map(ind =>
      ind.categoryDisabled ? { ...ind, categoryDisabled: false } : ind
    );

    editor.commands.setBiasIndicators(updatedIndicators, false);
    toast.info(t('whitelist.categories.enableAllCleared'));
  };

  const detectedCategories = useMemo(() => {
    const set = new Set<string>();
    for (const ind of biasIndicators) {
      if (!ind.outdated) set.add(ind.bias_indicator_key);
    }
    return set;
  }, [biasIndicators]);

  const handleWhitelistPhrase = (indicator: BiasIndicator) => {
    if (!editor) return;

    const phrase = indicator.detected_phrase;
    addWhitelistedPhrase(phrase);
    setDetectedWhitelistPhrases(prev => new Set(prev).add(phrase.toLowerCase()));

    // Remove ALL indicators with this phrase from current results
    const currentIndicators: BiasIndicator[] = editor.storage.biasDecorations?.indicators || [];
    const filtered = currentIndicators.filter(
      (ind: BiasIndicator) => ind.detected_phrase.toLowerCase() !== phrase.toLowerCase()
    );

    editor.commands.setBiasIndicators(filtered, false);
    toast.info(t('whitelist.added', { phrase }));
  };

  const groupedIndicators = useMemo(() => {
    const groups = new Map<string, BiasIndicator[]>();
    for (const indicator of biasIndicators) {
      if (indicator.outdated) continue;
      const key = indicator.bias_indicator_key;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(indicator);
    }
    // Sort groups by minimum displayIndex to preserve analysis order
    return Array.from(groups.entries()).sort((a, b) => {
      const minA = Math.min(...a[1].map(i => i.displayIndex ?? Infinity));
      const minB = Math.min(...b[1].map(i => i.displayIndex ?? Infinity));
      return minA - minB;
    });
  }, [biasIndicators]);

  const handlePdfUpload = usePdfUpload(editor, (errorMessage) => {
    toast.error(errorMessage);
  });

  const handleAnalyze = async (editor: Editor) => {
    setIsLoading(true);
    toast.dismiss();
    setBiasIndicators([]);
    setLexiconTerms([]);

      const plainText = editor.getText();
      const richText = editor.getHTML();

      // Detect language using franc
      const detectedLang = franc(plainText);
      // Map ISO 639-3 codes to language data
      const supportedLanguages: Record<string, { api: string; name: string }> = {
        'ell': { api: 'el', name: t('languages.en') },
        'fin': { api: 'fi', name: t('languages.fi') },
        'por': { api: 'pt', name: t('languages.pt') },
        'ces': { api: 'cs', name: t('languages.cs') },
        'eng': { api: 'en', name: t('languages.en') },
      };
      // Fallback to English if detected language is not supported
      const langData = supportedLanguages[detectedLang] || supportedLanguages['eng'];
      const language = langData.api;
      setDetectedLanguageCode(language ?? `${detectedLang.toUpperCase()} (not supported - defaulting to English)`);

      // All analysis is done in parallel, but sentiment is independent as its slower
      const indicatorsPromise = analyzeBiasIndicators(plainText, richText, language).catch(() => {
        toast.error('Bias Analysis Error');
        return [];
      });

      const llmIndicatorsPromise = analyzeLLMIndicators(plainText, richText, language, selectedModel).catch(() => {
        toast.error('LLM Analysis Error');
        return { indicators: [], modelUsed: '', isFallback: false, textTruncated: false, maxWordCount: undefined, contextLengthExceeded: false };
      });

      const lexiconTermsPromise = analyzeLexiconTerms(plainText, language).catch(() => {
        toast.error('Lexicon Analysis Error');
        return [];
      });

      Promise.all([indicatorsPromise, llmIndicatorsPromise, lexiconTermsPromise]).then(([indicators, llmResult, terms]) => {
        const allIndicators = [...indicators, ...llmResult.indicators];
        // Filter out whitelisted phrases and track which were detected
        const whitelist = getWhitelistedPhrases();
        const matchedWhitelistPhrases = new Set<string>();
        let afterWhitelist = allIndicators;
        if (whitelist.size > 0) {
          afterWhitelist = allIndicators.filter(ind => {
            const lower = ind.detected_phrase.toLowerCase();
            if (whitelist.has(lower)) {
              matchedWhitelistPhrases.add(lower);
              return false;
            }
            return true;
          });
        }
        setDetectedWhitelistPhrases(matchedWhitelistPhrases);
        if (matchedWhitelistPhrases.size > 0) {
          toast.info(t('whitelist.filteredCount', { count: matchedWhitelistPhrases.size }));
        }
        const dismissed = getDismissedCategories();
        const withDismissals = dismissed.size > 0
          ? afterWhitelist.map(ind => applyCategoryState(ind, dismissed))
          : afterWhitelist.map(ind => applyCategoryState(ind, new Set()));
        editor.commands.setBiasIndicators(withDismissals);
        editor.commands.setLexiconTerms(terms);
        setModelUsed(llmResult.modelUsed);
        setIsFallback(llmResult.isFallback);
        if (llmResult.contextLengthExceeded) {
          toast.error(t('llmAnalysis.contextLengthExceeded'));
        } else if (llmResult.textTruncated) {
          toast.warn(t('llmAnalysis.textTruncated', { count: llmResult.maxWordCount ?? 3200 }));
        }
        setIsLoading(false);
        setIsAnalysed(true);
        setIsSidebarOpen(true);
      });

      setIsSentimentLoading(true);
      analyzeSentiment(plainText, language, selectedModel)
      .catch(() => {
        toast.error('Sentiment Analysis Error');
        return [];
      })
      .then(results => {
        setSentimentResults(results);
        setIsSentimentLoading(false);
      });
  };

  return (
    <div className={`app-wrapper ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="app-header">
        <div className="logo-container">
          <img src={clarusLogo} alt="CLARUS Logo" className="logo" />
          <span className="logo-divider"></span>
          <span className="logo-text">{t('app.title', 'Clarity Checker')}</span>
        </div>
        <div className="header-controls">
          <PdfUploadButton onChange={handlePdfUpload} label={t('editor.uploadPdf')} />
          <span className="header-divider"></span>
          <WhitelistManager
            isOpen={isWhitelistOpen}
            onToggle={() => setIsWhitelistOpen(prev => !prev)}
            onPhraseRemoved={(phrase: string) => {
              setDetectedWhitelistPhrases(prev => {
                const next = new Set(prev);
                next.delete(phrase.toLowerCase());
                return next;
              });
              toast.info(t('whitelist.removed', { phrase }));
            }}
            onCleared={() => {
              setDetectedWhitelistPhrases(new Set());
              toast.info(t('whitelist.cleared'));
            }}
            phraseCount={detectedWhitelistPhrases.size}
            detectedPhrases={detectedWhitelistPhrases}
            categoryKeys={categoryKeys}
            disabledCategories={disabledCategories}
            detectedCategories={detectedCategories}
            onDisableCategory={handleDisableCategory}
            onEnableCategory={handleEnableCategory}
            onEnableAllCategories={handleEnableAllCategories}
          />
          <span className="header-divider"></span>
          <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
          <span className="header-divider"></span>
          <LanguageSelector />
          <span className="header-divider"></span>
          <button className="about-button" onClick={() => setIsAboutOpen(true)}>{t('about.openButton')}</button>
          <span className="header-divider"></span>
          <ThemeToggle />
        </div>
      </div>
      <div className="app-body">
      <div className="app">
      <div className="editor-layout">
        <div className={`main-content ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="analyzer-container">
            <TextEditor
              onHover={handleHover}
              onLexiconHover={handleLexiconHover}
              onAnalyze={handleAnalyze}
              onBiasIndicatorsUpdate={setBiasIndicators}
              onLexiconTermsUpdate={setLexiconTerms}
              onEditorReady={setEditor}
              isLoading={isLoading}
              detectedLanguageCode={detectedLanguageCode}
              modelUsed={modelUsed}
              isFallback={isFallback}
              isAnalysed={isAnalysed}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen(true)}
            />

            <LoadingOverlay isLoading={isLoading} />
            <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} onOpenTutorial={() => setIsTutorialOpen(true)} />
            <TutorialModal isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />

            {hoveredIndicators.length > 0 && popupPosition && (
              <BiasPopup
                key={`${currentHoveredIndicator?.bias_indicator_key ?? 'bias'}-${currentHoveredIndicator?.character_positions.start ?? 0}-${currentHoveredIndicator?.character_positions.end ?? 0}-${popupPosition.x}-${popupPosition.y}`}
                indicators={hoveredIndicators}
                activeIndex={activeIndicatorIndex}
                position={popupPosition}
                onDismiss={handleWhitelistPhrase}
                onNavigate={handlePopupNavigate}
              />
            )}

            {hoveredLexiconTerm && lexiconPopupPosition && (
              <LexiconPopup
                term={hoveredLexiconTerm}
                position={lexiconPopupPosition}
              />
            )}
          </div>
        </div>

      </div>
      <footer className="app-footer">
        <div className="footer-content">
          <p className="footer-text">
            {t('footer.funding', 'This project is co-funded by the European Union\'s Horizon Europe research and innovation programme under grant agreement No. 101121182')}
          </p>
          <div className="footer-logos">
            <div className="footer-logo-box">
              <img src={euLogo} alt="European Union Logo" className="footer-logo" />
            </div>
            <div className="footer-logo-box">
              <img src={ukriLogo} alt="UKRI Logo" className="footer-logo" />
            </div>
          </div>
        </div>
      </footer>
    </div>

    <div className={`analysis-sidebar ${isSidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-summary-bar">
        <button className="sidebar-close" onClick={() => setIsSidebarOpen(false)}><X size={20} /></button>
      </div>

      <div className="sidebar-section sidebar-findings">
        <div className="tabs-container">
          <div className="tabs-header">
            <button
              className={`tab-button ${activeTab === 'bias' ? 'active' : ''}`}
              onClick={() => setActiveTab('bias')}
            >
              {t('biasIndicators.title')} ({biasIndicators.filter(isIndicatorActive).length})
            </button>
            <button
              className={`tab-button ${activeTab === 'lexicon' ? 'active' : ''}`}
              onClick={() => setActiveTab('lexicon')}
            >
              {t('lexicon.title', 'Lexicon Terms')} ({lexiconTerms.length})
            </button>
            {(sentimentResults.length > 0 || isSentimentLoading) && (
              <button
                className={`tab-button ${activeTab === 'sentiment' ? 'active' : ''}`}
                onClick={() => setActiveTab('sentiment')}
              >
                {t('sidebar.sentimentTab', 'Sentiment')}
              </button>
            )}
          </div>

          <div className="tabs-content">
            {activeTab === 'bias' && (
              <>
                {biasIndicators.length > 0 ? (
                  <div className="bias-cards-container">
                    {groupedIndicators.map(([categoryKey, indicators]) => (
                      <BiasCardGroup
                        key={categoryKey}
                        categoryKey={categoryKey}
                        indicators={indicators}
                        onDismiss={handleWhitelistPhrase}
                        onDisableCategory={handleDisableCategory}
                        onEnableCategory={handleEnableCategory}
                        hoveredIndicator={currentHoveredIndicator}
                        onCardClick={handleCardClick}
                        onCardHoverStart={previewIndicator}
                        onCardHoverEnd={clearIndicatorPreview}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="placeholder-content">
                    <h3>{t('biasIndicators.title')}</h3>
                    <p>{isLoading ? t('biasIndicators.analyzing') : t('biasIndicators.noResults')}</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'lexicon' && (
              <>
                {lexiconTerms.length > 0 ? (
                  <div className="bias-cards-container">
                    {lexiconTerms.map((term, index) => (
                      <LexiconCard
                        key={`${term.word}-${index}`}
                        term={term}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="placeholder-content">
                    <h3>{t('lexicon.title', 'Lexicon Terms')}</h3>
                    <p>{isLoading ? t('lexicon.analyzing', 'Analyzing...') : t('lexicon.noResults', 'No lexicon terms found')}</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'sentiment' && (
              <div className="sidebar-sentiment-content">
                {sentimentResults.length > 0 ? (
                  <SentimentCard sentimentResults={sentimentResults} />
                ) : (
                  <div className="placeholder-content">
                    {isSentimentLoading ? (
                      <div className="sentiment-loading-spinner">
                        <div className="loader"></div>
                        <p>{t('sentiment.analyzing')}</p>
                      </div>
                    ) : (
                      <>
                        <h3>{t('sentiment.title')}</h3>
                        <p>{t('sentiment.noResults')}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
    </div>
    <ToastContainer
      position="bottom-left"
      autoClose={10000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnHover
      theme="colored"
      toastClassName={(context) => {
        const base = 'Toastify__toast';
        if (context?.type === 'error') return `${base} custom-toast-error`;
        if (context?.type === 'warning') return `${base} custom-toast-warning`;
        return `${base} custom-toast-info`;
      }}
      className="custom-toast-container"
    />
    </div>
  );
}

export default App;
