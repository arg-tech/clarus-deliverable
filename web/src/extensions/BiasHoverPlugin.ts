import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { BiasIndicator } from '../types';
import { setDismissTimeout, clearDismissTimeout, cleanupPopupListener, setPopupLeaveHandler } from './biasHoverState';

const EDITOR_HOVER_PREVIEW_DELAY_MS = 200;

interface BiasHoverOptions {
  onHover: (indicators: BiasIndicator[], position: { x: number; y: number } | null) => void;
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
    const editor = this.editor;
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
              const { from, to, className } = action.add;
              const decoration = Decoration.inline(from, to, { class: className || 'sentence-highlight' });
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
          let lastHoveredIds = '';
          let pendingHoveredIds = '';
          let pendingHoverTimeout: ReturnType<typeof setTimeout> | null = null;
          let wasHovering = false;

          const clearPendingHoverTimeout = () => {
            if (pendingHoverTimeout !== null) {
              clearTimeout(pendingHoverTimeout);
              pendingHoverTimeout = null;
            }
            pendingHoveredIds = '';
          };

          const dismissPopup = () => {
            clearPendingHoverTimeout();
            editorView.dispatch(
              editorView.state.tr.setMeta(biasHoverPluginKey, { remove: true })
            );
            onHover([], null);
            cleanupPopupListener();
            const highlightedMarkers = document.querySelectorAll('.bias-indicator-marker.highlighted');
            highlightedMarkers.forEach(marker => marker.classList.remove('highlighted'));
            wasHovering = false;
            lastHoveredIds = '';
          };

          const getStoredIndicators = (): BiasIndicator[] => {
            return editor?.storage?.biasDecorations?.indicators ?? [];
          };

          const getActiveStoredIndicators = (): BiasIndicator[] => {
            return getStoredIndicators().filter((indicator) => !indicator.outdated && !indicator.categoryDisabled);
          };

          const clearMarkerHighlights = () => {
            const highlightedMarkers = document.querySelectorAll('.bias-indicator-marker.highlighted');
            highlightedMarkers.forEach(marker => marker.classList.remove('highlighted'));
          };

          const highlightMarkers = (indicators: BiasIndicator[]) => {
            clearMarkerHighlights();

            if (indicators.length === 0) {
              return;
            }

            const hoveredIndexes = new Set(
              indicators
                .map(indicator => indicator.displayIndex)
                .filter((index): index is number => index !== undefined)
            );

            const markers = document.querySelectorAll('.bias-indicator-marker');
            markers.forEach((marker) => {
              const markerElement = marker as HTMLElement;
              const markerIndex = markerElement.dataset.index;

              if (markerIndex && hoveredIndexes.has(parseInt(markerIndex, 10))) {
                markerElement.classList.add('highlighted');
              }
            });
          };

          const calculatePopupPosition = (indicator: BiasIndicator): { x: number; y: number } => {
            const popupWidth = 320;
            const padding = 10;

            const endCoords = editorView.coordsAtPos(indicator.character_positions.end);
            let x = endCoords.right + 8;
            const y = endCoords.top;

            if (x + popupWidth > window.innerWidth - padding) {
              const startCoords = editorView.coordsAtPos(indicator.character_positions.start);
              x = startCoords.left - popupWidth - 8;
            }

            if (x < padding) {
              x = padding;
            }

            return { x, y };
          };

          const getMarkerElementsFromNode = (node: Node | null): HTMLElement | null => {
            if (!(node instanceof HTMLElement)) {
              return null;
            }

            if (node.classList.contains('bias-indicator-marker')) {
              return node;
            }

            if (!node.classList.contains('bias-marker-wrapper')) {
              return null;
            }

            const marker = node.querySelector('.bias-indicator-marker');
            return marker instanceof HTMLElement ? marker : null;
          };

          const getGroupedMarkerElements = (markerElement: HTMLElement): HTMLElement[] => {
            const wrapper = markerElement.closest('.bias-marker-wrapper');
            if (!(wrapper instanceof HTMLElement)) {
              return [markerElement];
            }

            const groupedMarkers: HTMLElement[] = [markerElement];

            const collectMarkers = (direction: 'previousSibling' | 'nextSibling') => {
              let current: Node | null = wrapper[direction];

              while (current) {
                if (current.nodeType === Node.TEXT_NODE) {
                  if (current.textContent?.trim() === '') {
                    current = direction === 'previousSibling' ? current.previousSibling : current.nextSibling;
                    continue;
                  }

                  break;
                }

                const adjacentMarker = getMarkerElementsFromNode(current);
                if (!adjacentMarker) {
                  break;
                }

                if (direction === 'previousSibling') {
                  groupedMarkers.unshift(adjacentMarker);
                } else {
                  groupedMarkers.push(adjacentMarker);
                }

                current = direction === 'previousSibling' ? current.previousSibling : current.nextSibling;
              }
            };

            collectMarkers('previousSibling');
            collectMarkers('nextSibling');

            return groupedMarkers;
          };

          const getGroupedMarkerIndexes = (markerElements: HTMLElement[]): Set<number> => {
            return new Set(
              markerElements
                .map((element) => element.dataset.index)
                .map((index) => (index ? parseInt(index, 10) : NaN))
                .filter((index) => Number.isFinite(index))
            );
          };

          const calculateMarkerGroupPopupPosition = (markerElements: HTMLElement[]): { x: number; y: number } => {
            const popupWidth = 320;
            const padding = 10;
            const rects = markerElements.map((element) => element.getBoundingClientRect());
            const left = Math.min(...rects.map((rect) => rect.left));
            const right = Math.max(...rects.map((rect) => rect.right));
            const top = Math.min(...rects.map((rect) => rect.top));

            let x = right + 8;
            const y = top;

            if (x + popupWidth > window.innerWidth - padding) {
              x = left - popupWidth - 8;
            }

            if (x < padding) {
              x = padding;
            }

            return { x, y };
          };

          const scheduleDismiss = () => {
            clearDismissTimeout();
            setDismissTimeout(() => {
              const popup = document.querySelector('.bias-popup:hover');
              if (popup) {
                const handler = () => dismissPopup();
                setPopupLeaveHandler(handler);
                popup.addEventListener('mouseleave', handler, { once: true });
              } else {
                dismissPopup();
              }
            }, 200);
          };

          const updateHoverState = (hoveredIndicators: BiasIndicator[], position: { x: number; y: number }) => {
            clearDismissTimeout();
            cleanupPopupListener();
            highlightMarkers(hoveredIndicators);

            const currentIds = hoveredIndicators.map(indicator => indicator.displayIndex).sort().join(',');
            wasHovering = true;

            if (currentIds === lastHoveredIds) {
              return;
            }

            lastHoveredIds = currentIds;
            const first = hoveredIndicators[0];

            editorView.dispatch(
              editorView.state.tr.setMeta(biasHoverPluginKey, {
                add: { from: first.character_positions.start, to: first.character_positions.end }
              })
            );

            onHover(hoveredIndicators, position);
          };

          const scheduleHoverStateUpdate = (hoveredIndicators: BiasIndicator[], position: { x: number; y: number }) => {
            const currentIds = hoveredIndicators.map(indicator => indicator.displayIndex).sort().join(',');

            clearDismissTimeout();
            cleanupPopupListener();

            if (currentIds === lastHoveredIds || currentIds === pendingHoveredIds) {
              return;
            }

            clearPendingHoverTimeout();
            pendingHoveredIds = currentIds;
            pendingHoverTimeout = setTimeout(() => {
              pendingHoverTimeout = null;
              pendingHoveredIds = '';
              updateHoverState(hoveredIndicators, position);
            }, EDITOR_HOVER_PREVIEW_DELAY_MS);
          };

          const handleMouseMove = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const markerElement = target.closest('.bias-indicator-marker') as HTMLElement | null;
            const activeIndicators = getActiveStoredIndicators();

            if (markerElement) {
              const groupedMarkerElements = getGroupedMarkerElements(markerElement);
              const groupedMarkerIndexes = getGroupedMarkerIndexes(groupedMarkerElements);
              const hoveredIndicators = activeIndicators.filter(
                indicator => indicator.displayIndex !== undefined && groupedMarkerIndexes.has(indicator.displayIndex)
              );

              if (hoveredIndicators.length > 0) {
                scheduleHoverStateUpdate(hoveredIndicators, calculateMarkerGroupPopupPosition(groupedMarkerElements));
                return;
              }
            }

            const pos = editorView.posAtCoords({ left: event.clientX, top: event.clientY });
            if (!pos) {
              return;
            }

            const hoverPos = pos.pos;
            const hoveredIndicators = activeIndicators.filter((indicator) => {
              const start = indicator.character_positions.start;
              const end = indicator.character_positions.end;
              return hoverPos >= start && hoverPos <= end;
            });

            if (hoveredIndicators.length > 0) {
              scheduleHoverStateUpdate(hoveredIndicators, calculatePopupPosition(hoveredIndicators[0]));
            } else if (wasHovering) {
              clearPendingHoverTimeout();
              wasHovering = false;
              lastHoveredIds = '';
              clearMarkerHighlights();
              scheduleDismiss();
            } else {
              clearPendingHoverTimeout();
            }
          };

          const handleMouseLeave = (event: MouseEvent) => {
            const nextTarget = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;

            if (nextTarget?.closest('.bias-popup')) {
              clearDismissTimeout();
              cleanupPopupListener();

              const popup = nextTarget.closest('.bias-popup');
              if (popup) {
                const handler = () => dismissPopup();
                setPopupLeaveHandler(handler);
                popup.addEventListener('mouseleave', handler, { once: true });
              }

              return;
            }

            clearPendingHoverTimeout();

            if (wasHovering) {
              wasHovering = false;
              lastHoveredIds = '';
              clearMarkerHighlights();
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
