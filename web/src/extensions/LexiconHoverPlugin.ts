import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { LexiconTerm } from '../types';

const EDITOR_HOVER_PREVIEW_DELAY_MS = 200;

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
    const editor = this.editor;
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
          let activeTermKey = '';
          let pendingTermKey = '';
          let pendingHoverTimeout: ReturnType<typeof setTimeout> | null = null;
          let dismissTimeout: ReturnType<typeof setTimeout> | null = null;
          let popupLeaveHandler: (() => void) | null = null;
          let popupElement: Element | null = null;
          let wasHovering = false;

          const clearPendingHoverTimeout = () => {
            if (pendingHoverTimeout !== null) {
              clearTimeout(pendingHoverTimeout);
              pendingHoverTimeout = null;
            }
            pendingTermKey = '';
          };

          const clearDismissTimeout = () => {
            if (dismissTimeout !== null) {
              clearTimeout(dismissTimeout);
              dismissTimeout = null;
            }
          };

          const cleanupPopupListener = () => {
            if (popupElement && popupLeaveHandler) {
              popupElement.removeEventListener('mouseleave', popupLeaveHandler);
              popupLeaveHandler = null;
              popupElement = null;
            }
          };

          const dismissPopup = () => {
            clearPendingHoverTimeout();
            clearDismissTimeout();
            cleanupPopupListener();
            editorView.dispatch(
              editorView.state.tr.setMeta(lexiconHoverPluginKey, { remove: true })
            );
            onHover(null, null);
            wasHovering = false;
            activeTermKey = '';
          };

          const scheduleDismiss = () => {
            clearDismissTimeout();
            dismissTimeout = setTimeout(() => {
              const popup = document.querySelector('.lexicon-popup:hover');
              if (popup) {
                const handler = () => dismissPopup();
                cleanupPopupListener();
                popupLeaveHandler = handler;
                popupElement = popup;
                popup.addEventListener('mouseleave', handler, { once: true });
              } else {
                dismissPopup();
              }
            }, 200);
          };

          const getStoredTerms = (): LexiconTerm[] => {
            return editor?.storage?.lexiconDecorations?.terms ?? [];
          };

          const calculatePopupPosition = (term: LexiconTerm): { x: number; y: number } => {
            const popupWidth = 320;
            const popupHeight = 200;
            const padding = 10;

            const endCoords = editorView.coordsAtPos(term.character_positions.end);
            let x = endCoords.right + 8;
            let y = endCoords.top;

            if (x + popupWidth > window.innerWidth - padding) {
              const startCoords = editorView.coordsAtPos(term.character_positions.start);
              x = startCoords.left - popupWidth - 8;
            }

            if (x < padding) {
              x = padding;
            }

            if (y + popupHeight > window.innerHeight - padding) {
              y = endCoords.bottom - popupHeight - 5;
            }

            return { x, y };
          };

          const scheduleHoverStateUpdate = (term: LexiconTerm, position: { x: number; y: number }) => {
            const termKey = `${term.character_positions.start}:${term.character_positions.end}:${term.word}`;

            clearDismissTimeout();
            cleanupPopupListener();

            if (termKey === activeTermKey || termKey === pendingTermKey) {
              return;
            }

            clearPendingHoverTimeout();
            pendingTermKey = termKey;
            pendingHoverTimeout = setTimeout(() => {
              pendingHoverTimeout = null;
              pendingTermKey = '';
              activeTermKey = termKey;
              wasHovering = true;

              editorView.dispatch(
                editorView.state.tr.setMeta(lexiconHoverPluginKey, {
                  add: { from: term.character_positions.start, to: term.character_positions.end }
                })
              );

              onHover(term, position);
            }, EDITOR_HOVER_PREVIEW_DELAY_MS);
          };

          const handleMouseMove = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const markerElement = target.closest('.lexicon-term-marker') as HTMLElement | null;
            const terms = getStoredTerms();

            if (markerElement) {
              const start = parseInt(markerElement.dataset.charStart || '0', 10);
              const end = parseInt(markerElement.dataset.charEnd || '0', 10);
              const term = terms.find(t => t.character_positions.start === start && t.character_positions.end === end);

              if (term) {
                scheduleHoverStateUpdate(term, calculatePopupPosition(term));
                return;
              }
            }

            const pos = editorView.posAtCoords({ left: event.clientX, top: event.clientY });
            if (!pos) {
              return;
            }

            const hoverPos = pos.pos;
            const hoveredTerm = terms.find(term => {
              const start = term.character_positions.start;
              const end = term.character_positions.end;
              return hoverPos >= start && hoverPos <= end;
            });

            if (hoveredTerm) {
              scheduleHoverStateUpdate(hoveredTerm, calculatePopupPosition(hoveredTerm));
            } else if (wasHovering) {
              clearPendingHoverTimeout();
              wasHovering = false;
              activeTermKey = '';
              scheduleDismiss();
            } else {
              clearPendingHoverTimeout();
            }
          };

          const handleMouseLeave = (event: MouseEvent) => {
            const nextTarget = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;

            if (nextTarget?.closest('.lexicon-popup')) {
              clearDismissTimeout();
              cleanupPopupListener();

              const popup = nextTarget.closest('.lexicon-popup');
              if (popup) {
                const handler = () => dismissPopup();
                popupLeaveHandler = handler;
                popupElement = popup;
                popup.addEventListener('mouseleave', handler, { once: true });
              }

              return;
            }

            clearPendingHoverTimeout();

            if (wasHovering) {
              wasHovering = false;
              activeTermKey = '';
              scheduleDismiss();
            }
          };

          editorView.dom.addEventListener('mousemove', handleMouseMove);
          editorView.dom.addEventListener('mouseleave', handleMouseLeave);

          return {
            destroy() {
              clearPendingHoverTimeout();
              clearDismissTimeout();
              cleanupPopupListener();
              editorView.dom.removeEventListener('mousemove', handleMouseMove);
              editorView.dom.removeEventListener('mouseleave', handleMouseLeave);
            }
          };
        }
      })
    ];
  }
});
