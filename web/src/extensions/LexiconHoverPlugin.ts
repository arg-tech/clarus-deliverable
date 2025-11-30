import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { LexiconTerm } from '../types';

interface LexiconHoverOptions {
  onHover: (term: LexiconTerm | null, position: { x: number; y: number } | null) => void;
}

export const lexiconHoverPluginKey = new PluginKey('lexiconHoverPlugin');

export const LexiconHover = Extension.create<LexiconHoverOptions>({
  name: 'lexiconHover',
  
  addOptions() {
    return {
      onHover: () => {},
    };
  },
  
  addProseMirrorPlugins() {
    const { onHover } = this.options;
    
    return [
      new Plugin({
        key: lexiconHoverPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => {
            // Adjust decoration positions on change
            set = set.map(tr.mapping, tr.doc);

            const action = tr.getMeta(lexiconHoverPluginKey);

            if (action && action.add) {
              const { from, to } = action.add;
              const decoration = Decoration.inline(from, to, { class: 'lexicon-sentence-highlight' });
              set = DecorationSet.create(tr.doc, [decoration]);
            } else if (action && action.remove) {
              set = DecorationSet.empty;
            }

            return set;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
        view: (editorView: EditorView) => {
          const handleMouseOver = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            if (!target.classList.contains('lexicon-term-marker')) return;
            
            const markerElement = target;
            
            const rect = markerElement.getBoundingClientRect();
            const popupWidth = 320;
            const popupHeight = 200;
            const padding = 10;
            
            let x = rect.left;
            let y = rect.bottom + 5;
            
            if (x + popupWidth > window.innerWidth - padding) {
              x = window.innerWidth - popupWidth - padding;
            }
            if (x < padding) {
              x = padding;
            }
            
            if (y + popupHeight > window.innerHeight - padding) {
              y = rect.top - popupHeight - 5;
            }

            const start = parseInt(markerElement.dataset.charStart || '0', 10);
            const end = parseInt(markerElement.dataset.charEnd || '0', 10);

            if (start && end) {
              editorView.dispatch(
                editorView.state.tr.setMeta(lexiconHoverPluginKey, { add: { from: start, to: end } })
              );
            }

            // Get term data from HTML data attributes
            const term: LexiconTerm = {
              word: markerElement.dataset.word || '',
              definition: markerElement.dataset.definition || '',
              usage_example: markerElement.dataset.usageExample || '',
              character_positions: { start, end },
            };
            
            onHover(term, { x, y });
          };

          const handleMouseOut = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            if (target.classList.contains('lexicon-term-marker') || 
                target.classList.contains('lexicon-marker-wrapper') ||
                target.querySelector('.lexicon-term-marker')) {
              
              editorView.dispatch(
                editorView.state.tr.setMeta(lexiconHoverPluginKey, { remove: true })
              );
              onHover(null, null);
            }
          };
          
          editorView.dom.addEventListener('mouseover', handleMouseOver);
          editorView.dom.addEventListener('mouseout', handleMouseOut);
          
          return {
            destroy() {
              editorView.dom.removeEventListener('mouseover', handleMouseOver);
              editorView.dom.removeEventListener('mouseout', handleMouseOut);
            }
          };
        }
      })
    ];
  }
});
