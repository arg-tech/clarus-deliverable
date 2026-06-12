import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { useEffect, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon, Strikethrough, FileText, Search, Trash2 } from 'lucide-react';
import { BiasDecorations } from '../extensions/BiasDecorations';
import { LexiconDecorations } from '../extensions/LexiconDecorations';
import { BiasHover } from '../extensions/BiasHoverPlugin';
import { LexiconHover } from '../extensions/LexiconHoverPlugin';
import type { BiasIndicator, LexiconTerm } from '../types';

interface TextEditorProps {
  onHover: (indicators: BiasIndicator[], position: { x: number; y: number } | null) => void;
  onLexiconHover: (term: LexiconTerm | null, position: { x: number; y: number } | null) => void;
  onAnalyze: (editor: Editor) => void;
  onBiasIndicatorsUpdate?: (indicators: BiasIndicator[]) => void;
  onLexiconTermsUpdate?: (terms: LexiconTerm[]) => void;
  onEditorReady?: (editor: Editor) => void;
  isLoading: boolean;
  detectedLanguageCode?: string;
  modelUsed?: string;
  isFallback?: boolean;
  isAnalysed?: boolean;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const TextEditor = ({ onHover, onLexiconHover, onAnalyze, onBiasIndicatorsUpdate, onLexiconTermsUpdate, onEditorReady, isLoading, modelUsed, isFallback, isAnalysed, isSidebarOpen, onToggleSidebar }: TextEditorProps) => {
  const { t } = useTranslation();
  const editor = useEditor({
    autofocus: 'start',
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        listItem: false,
        orderedList: false,
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

  const toggleBold = () => editor?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor?.chain().focus().toggleUnderline().run();
  const toggleStrike = () => editor?.chain().focus().toggleStrike().run();
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

  const handleEditorContainerClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      editor?.chain().focus().run();
    }
  };

  if (!editor) {
    return <div>{t('loading.editor')}</div>;
  }

  return (
    <div className="input-section">
      <div className="editor-container">
        <div className="editor-toolbar">
          <div className="toolbar-left">
            <div className="toolbar-group">
              <button
                type="button"
                onClick={toggleBold}
                className={`toolbar-button ${editor.isActive('bold') ? 'active' : ''}`}
                title={t('editor.toolbar.bold')}
              >
                <BoldIcon size={16} />
              </button>
              <button
                type="button"
                onClick={toggleItalic}
                className={`toolbar-button ${editor.isActive('italic') ? 'active' : ''}`}
                title={t('editor.toolbar.italic')}
              >
                <ItalicIcon size={16} />
              </button>
              <button
                type="button"
                onClick={toggleUnderline}
                className={`toolbar-button ${editor.isActive('underline') ? 'active' : ''}`}
                title={t('editor.toolbar.underline')}
              >
                <UnderlineIcon size={16} />
              </button>
              <button
                type="button"
                onClick={toggleStrike}
                className={`toolbar-button ${editor.isActive('strike') ? 'active' : ''}`}
                title={t('editor.toolbar.strikethrough')}
              >
                <Strikethrough size={16} />
              </button>
            </div>

            {modelUsed && (
              <>
                <div className="toolbar-separator" />
                <div className="toolbar-info">
                  <span>
                    {isFallback
                      ? t('editor.modelUsedFallback', {model: t(`model.${modelUsed}`)})
                      : t('editor.modelUsed', {model: t(`model.${modelUsed}`)})
                    }
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="toolbar-actions">
            {isAnalysed && !isSidebarOpen && onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="sidebar-toggle-button"
              >
                <FileText width={16} height={16} />
                {t('sidebar.title', 'Analysis Results')}
              </button>
            )}
            <button
              onClick={handleAnalyzeClick}
              disabled={isLoading || !editor.getText().trim()}
              className="analyze-button"
            >
              <Search width={14} height={14} />
              {isLoading ? t('editor.analyzing') : t('editor.analyze')}
            </button>
            <button
              onClick={handleClearClick}
              disabled={isLoading || !editor.getText().trim()}
              className="clear-button"
            >
              <Trash2 width={14} height={14} />
              {t('editor.clear', 'Clear Text')}
            </button>
          </div>
        </div>

        <div className="editor-content-shell" onClick={handleEditorContainerClick}>
          <EditorContent editor={editor} className="editor-content" />
        </div>
      </div>
    </div>
  );
};
