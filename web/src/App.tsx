import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import { TextEditor, BiasPopup, LexiconPopup, BiasCard, LexiconCard, SentimentCard, LoadingOverlay, LanguageSelector, ModelSelector, PdfUploadButton } from './components';
import { analyzeBiasIndicators } from './services/biasAnalysis';
import { analyzeSentiment } from './services/sentimentAnalysis';
import { analyzeLLMIndicators } from './services/llmAnalysis';
import { analyzeLexiconTerms } from './services/lexiconAnalysis';
import type { BiasIndicator, LexiconTerm } from './types';
import type { SentimentResult } from './services/sentimentAnalysis';
import { franc } from 'franc';
import clarusLogo from './assets/clarus-logo.png';
import euLogo from './assets/eu-logo.png';
import ukriLogo from './assets/ukri-logo.png';
import './App.css';
import { usePdfUpload } from './hooks/usePdfUpload';

function App() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalysed, setIsAnalysed] = useState(false);
  const [analysisErrors, setAnalysisErrors] = useState<string[]>([]);
  const [hoveredIndicator, setHoveredIndicator] = useState<BiasIndicator | null>(null);
  const [hoveredLexiconTerm, setHoveredLexiconTerm] = useState<LexiconTerm | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [lexiconPopupPosition, setLexiconPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [biasIndicators, setBiasIndicators] = useState<BiasIndicator[]>([]);
  const [lexiconTerms, setLexiconTerms] = useState<LexiconTerm[]>([]);
  const [sentimentResults, setSentimentResults] = useState<SentimentResult[]>([]);
  const [detectedLanguageCode, setDetectedLanguageCode] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<'local' | 'remote'>('local');
  const [modelUsed, setModelUsed] = useState<string>('');
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [activeTab, setActiveTab] = useState<'bias' | 'lexicon'>('bias');

  const handleHover = (indicator: BiasIndicator | null, position: { x: number; y: number } | null) => {
    setHoveredIndicator(indicator);
    setPopupPosition(position);
  };

  const handleLexiconHover = (term: LexiconTerm | null, position: { x: number; y: number } | null) => {
    setHoveredLexiconTerm(term);
    setLexiconPopupPosition(position);
  };

  const handleMarkIndicatorOutdated = (indicator: BiasIndicator) => {
    if (!editor) return;
    
    const currentIndicators = editor.storage.biasDecorations?.indicators || [];
    const updatedIndicators = currentIndicators.map((ind: BiasIndicator) => 
      ind === indicator ? { ...ind, outdated: true } : ind
    );
    
    editor.commands.setBiasIndicators(updatedIndicators, false);
  };

  const handlePdfUpload = usePdfUpload(editor, (errorMessage) => {
    setAnalysisErrors(prevErrors => [...prevErrors, errorMessage]);
  });

  const handleAnalyze = async (editor: Editor) => {
    setIsLoading(true);
    setAnalysisErrors([]);
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
        setAnalysisErrors(prevErrors => [...prevErrors, 'Bias Analysis Error']);
        return [];
      });

      const llmIndicatorsPromise = analyzeLLMIndicators(plainText, richText, language, selectedModel).catch((error) => {
        const errorMessage = error.message === 'CONTEXT_LENGTH_EXCEEDED' 
          ? 'LLM Analysis Error - maximum word count exceeded'
          : 'LLM Analysis Error';
        setAnalysisErrors(prevErrors => [...prevErrors, errorMessage]);
        return { indicators: [], modelUsed: '', isFallback: false };
      });

      const lexiconTermsPromise = analyzeLexiconTerms(plainText, language).catch(() => {
        setAnalysisErrors(prevErrors => [...prevErrors, 'Lexicon Analysis Error']);
        return [];
      });

      Promise.all([indicatorsPromise, llmIndicatorsPromise, lexiconTermsPromise]).then(([indicators, llmResult, terms]) => {
        editor.commands.setBiasIndicators([...indicators, ...llmResult.indicators]);
        editor.commands.setLexiconTerms(terms);
        setModelUsed(llmResult.modelUsed);
        setIsFallback(llmResult.isFallback);
        setIsLoading(false);
        setIsAnalysed(true);
      });

      analyzeSentiment(plainText, language)
      .catch(() => {
        setAnalysisErrors(prevErrors => [...prevErrors, 'Sentiment Analysis Error']);
        return [];
      })
      .then(results => {
        setSentimentResults(results);
      });
  };

  return (
    <div className="app">
      <div className="app-header">
        <div className="logo-container">
          <img src={clarusLogo} alt="CLARUS Logo" className="logo" />
          <span className="logo-divider"></span>
          <span className="logo-text">{t('app.title', 'Bias Checker')}</span>
        </div>
        <div className="header-controls">
          <PdfUploadButton onChange={handlePdfUpload} />
          <span className="header-divider"></span>
          <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
          <span className="header-divider"></span>
          <LanguageSelector />
        </div>
      </div>
      <div className="three-column-layout">
        <div className={`left-column ${!isAnalysed ? 'hidden-column' : ''}`}>
          <div className="tabs-container">
            <div className="tabs-header">
              <button 
                className={`tab-button ${activeTab === 'bias' ? 'active' : ''}`}
                onClick={() => setActiveTab('bias')}
              >
                {t('biasIndicators.title')} ({biasIndicators.length})
              </button>
              <button 
                className={`tab-button ${activeTab === 'lexicon' ? 'active' : ''}`}
                onClick={() => setActiveTab('lexicon')}
              >
                {t('lexicon.title', 'Lexicon Terms')} ({lexiconTerms.length})
              </button>
            </div>

            <div className="tabs-content">
              {activeTab === 'bias' && (
                <>
                  {biasIndicators.length > 0 ? (
                    <div className="bias-cards-container">
                      {biasIndicators.map((indicator, index) => (
                        <BiasCard 
                          key={`${indicator.bias_indicator_key}-${index}`}
                          indicator={indicator}
                          onMarkOutdated={handleMarkIndicatorOutdated}
                          isHighlighted={
                            hoveredIndicator !== null &&
                            hoveredIndicator.displayIndex !== undefined &&
                            hoveredIndicator.displayIndex === indicator.displayIndex
                          }
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
            </div>
          </div>
        </div>

        {/* Middle column - 50% */}
        <div className={`middle-column`}>
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
            />

            <LoadingOverlay isLoading={isLoading} />

            <div className="controls-container">
            </div>

            {analysisErrors.length > 0 && (
              <div className="error-section">
                <h3>{t('error.title')}</h3>
                {analysisErrors.map((error, idx) => (
                  <p key={idx}>{error}</p>
                ))}
              </div>
            )}
            
            {hoveredIndicator && popupPosition && (
              <BiasPopup 
                indicator={hoveredIndicator}
                position={popupPosition}
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

        {/* Right column - 25% */}
        <div className={`right-column ${!isAnalysed ? 'hidden-column' : ''}`}>
          {sentimentResults.length > 0 ? (
            <SentimentCard sentimentResults={sentimentResults} />
          ) : (
            <div className="placeholder-content">
              <h3>{t('sentiment.title')}</h3>
              <p>{isLoading ? t('sentiment.analyzing') : t('sentiment.noResults')}</p>
            </div>
          )}
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
  );
}

export default App;
