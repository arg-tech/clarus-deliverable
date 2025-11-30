import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { BiasIndicator } from '../types';

interface BiasHoverOptions {
  onHover: (indicator: BiasIndicator | null, position: { x: number; y: number } | null) => void;
}

export const biasHoverPluginKey = new PluginKey('biasHoverPlugin');

export const BiasHover = Extension.create<BiasHoverOptions>({
  name: 'biasHover',
  
  addOptions() {
    return {
      onHover: () => {},
    };
  },
  
  addProseMirrorPlugins() {
    const { onHover } = this.options;
    
    return [
      new Plugin({
        key: biasHoverPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => {
            // Adjust decoration positions on change
            set = set.map(tr.mapping, tr.doc);

            const action = tr.getMeta(biasHoverPluginKey);

            if (action && action.add) {
              const { from, to } = action.add;
              const decoration = Decoration.inline(from, to, { class: 'sentence-highlight' });
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
            
            if (!target.classList.contains('bias-indicator-marker')) return;

            // Todo: Fix excessive events
            console.log('Mouse over bias indicator');
            
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
                editorView.state.tr.setMeta(biasHoverPluginKey, { add: { from: start, to: end } })
              );
            }

            // Get indicator data from HTML data attributes
            const indicator: BiasIndicator = {
              bias_indicator_key: markerElement.dataset.biasIndicatorKey || '',
              detected_phrase: markerElement.dataset.detectedPhrase || '',
              character_positions: { start, end },
              confidence: markerElement.dataset.confidence || '',
              displayIndex: markerElement.dataset.index ? parseInt(markerElement.dataset.index, 10) : undefined,
            };
            
            onHover(indicator, { x, y });
          };

          const handleMouseOut = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            if (target.classList.contains('bias-indicator-marker') || 
                target.classList.contains('bias-marker-wrapper') ||
                target.querySelector('.bias-indicator-marker')) {
              
              editorView.dispatch(
                editorView.state.tr.setMeta(biasHoverPluginKey, { remove: true })
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
