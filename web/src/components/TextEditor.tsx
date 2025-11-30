import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BiasDecorations } from '../extensions/BiasDecorations';
import { LexiconDecorations } from '../extensions/LexiconDecorations';
import { BiasHover } from '../extensions/BiasHoverPlugin';
import { LexiconHover } from '../extensions/LexiconHoverPlugin';
import { BiasTextHover } from '../extensions/BiasTextHover';
import type { BiasIndicator, LexiconTerm } from '../types';

interface TextEditorProps {
  onHover: (indicator: BiasIndicator | null, position: { x: number; y: number } | null) => void;
  onLexiconHover: (term: LexiconTerm | null, position: { x: number; y: number } | null) => void;
  onAnalyze: (editor: Editor) => void;
  onBiasIndicatorsUpdate?: (indicators: BiasIndicator[]) => void;
  onLexiconTermsUpdate?: (terms: LexiconTerm[]) => void;
  onEditorReady?: (editor: Editor) => void;
  isLoading: boolean;
  detectedLanguageCode?: string;
  modelUsed?: string;
  isFallback?: boolean;
}

export const TextEditor = ({ onHover, onLexiconHover, onAnalyze, onBiasIndicatorsUpdate, onLexiconTermsUpdate, onEditorReady, isLoading, detectedLanguageCode, modelUsed, isFallback }: TextEditorProps) => {
  const { t } = useTranslation();
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
      }),
      Underline,
      BiasDecorations,
      LexiconDecorations,
      BiasHover.configure({
        onHover,
      }),
      LexiconHover.configure({
        onHover: onLexiconHover,
      }),
      BiasTextHover,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });
  
  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);
  
  // Set up event listener for bias indicator updates
  useEffect(() => {
    if (!onBiasIndicatorsUpdate) return;
    
    const handleBiasIndicatorsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ indicators: BiasIndicator[] }>;
      onBiasIndicatorsUpdate(customEvent.detail.indicators);
    };
    
    window.addEventListener('biasIndicatorsUpdated', handleBiasIndicatorsUpdated);
    
    return () => {
      window.removeEventListener('biasIndicatorsUpdated', handleBiasIndicatorsUpdated);
    };
  }, [onBiasIndicatorsUpdate]);

  // Set up event listener for lexicon term updates
  useEffect(() => {
    if (!onLexiconTermsUpdate) return;
    
    const handleLexiconTermsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ terms: LexiconTerm[] }>;
      onLexiconTermsUpdate(customEvent.detail.terms);
    };
    
    window.addEventListener('lexiconTermsUpdated', handleLexiconTermsUpdated);
    
    return () => {
      window.removeEventListener('lexiconTermsUpdated', handleLexiconTermsUpdated);
    };
  }, [onLexiconTermsUpdate]);

  const toggleBold = () => {
    editor?.chain().focus().toggleBold().run();
  };

  const toggleItalic = () => {
    editor?.chain().focus().toggleItalic().run();
  };

  const toggleUnderline = () => {
    editor?.chain().focus().toggleUnderline().run();
  };

  const handleAnalyzeClick = () => {
    if (editor) {
      onAnalyze(editor);
    }
  };

  const handleClearClick = () => {
    if (editor) {
      editor.commands.clearContent();
      editor.commands.setBiasIndicators([]);
      editor.commands.setLexiconTerms([]);
    }
  };

  if (!editor) {
    return <div>{t('loading.editor')}</div>;
  }

  return (
    <div className="input-section">
      <div className="editor-container">
        <div className="editor-toolbar">
          <button
            type="button"
            onClick={toggleBold}
            className={`toolbar-button ${editor.isActive('bold') ? 'active' : ''}`}
            title={t('editor.toolbar.bold')}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={toggleItalic}
            className={`toolbar-button ${editor.isActive('italic') ? 'active' : ''}`}
            title={t('editor.toolbar.italic')}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={toggleUnderline}
            className={`toolbar-button ${editor.isActive('underline') ? 'active' : ''}`}
            title={t('editor.toolbar.underline')}
          >
            <u>U</u>
          </button>
        </div>
        
        <EditorContent editor={editor} />
      </div>
      
      <div className="language-info">
        {detectedLanguageCode && (
          <div>{t('editor.detectedLanguage', {language: t(`languages.${detectedLanguageCode}`)})}</div>
        )}
        {modelUsed && (
          <div>
            {isFallback 
              ? t('editor.modelUsedFallback', {model: t(`model.${modelUsed}`)})
              : t('editor.modelUsed', {model: t(`model.${modelUsed}`)})
            }
          </div>
        )}
      </div>
      
      <div className="button-group">
        <button 
          onClick={handleAnalyzeClick}
          disabled={isLoading || !editor.getText().trim()}
          className="analyze-button"
        >
          {isLoading ? t('editor.analyzing') : t('editor.analyze')}
        </button>
        <button 
          onClick={handleClearClick}
          disabled={isLoading || !editor.getText().trim()}
          className="clear-button"
        >
          {t('editor.clear', 'Clear Text')}
        </button>
      </div>
    </div>
  );
};
