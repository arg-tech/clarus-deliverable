import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { BiasIndicator } from '../types';

export const biasTextHoverPluginKey = new PluginKey('biasTextHoverPlugin');

export const BiasTextHover = Extension.create({
  name: 'biasTextHover',
  
  addProseMirrorPlugins() {
    const editor = this.editor;
    
    return [
      new Plugin({
        key: biasTextHoverPluginKey,
        view: (editorView: EditorView) => {
          const handleMouseMove = (event: MouseEvent) => {
            // Check if we're hovering over a bias marker itself
            const target = event.target as HTMLElement;
            // console.log('Target element:', target, 'Classes:', target.className);
            
            if (target.classList.contains('bias-indicator-marker') || 
                target.classList.contains('bias-marker-wrapper') ||
                target.closest('.bias-indicator-marker') ||
                target.closest('.bias-marker-wrapper')) {
              // console.log('Hovering over marker - clearing highlights');
              // Clear all highlights when hovering over markers themselves
              const allMarkers = document.querySelectorAll('.bias-indicator-marker.highlighted');
              allMarkers.forEach(marker => marker.classList.remove('highlighted'));
              return;
            }
            
            // console.log('Hovering over regular text');
            
            // Get the position from the mouse event
            const pos = editorView.posAtCoords({ left: event.clientX, top: event.clientY });
            if (!pos) {
              return;
            }
            
            const hoverPos = pos.pos;
            // console.log('Hover position:', hoverPos);
            
            // Get bias indicators from editor storage
            const biasIndicators: BiasIndicator[] = editor.storage.biasDecorations?.indicators || [];
            
            // Remove all existing highlights first
            const allMarkers = document.querySelectorAll('.bias-indicator-marker.highlighted');
            allMarkers.forEach(marker => marker.classList.remove('highlighted'));
            
            // Find indicators that contain the hover position
            const hoveredIndicators = biasIndicators.filter((indicator: BiasIndicator) => {
              const start = indicator.character_positions.start;
              const end = indicator.character_positions.end;
              return hoverPos >= start && hoverPos <= end;
            });
            
            // Highlight the markers for hovered indicators
            if (hoveredIndicators.length > 0) {
              const markers = document.querySelectorAll('.bias-indicator-marker');
              
              markers.forEach((marker) => {
                const markerElement = marker as HTMLElement;
                const markerIndex = markerElement.dataset.index;
                
                if (markerIndex) {
                  const displayIndex = parseInt(markerIndex, 10);
                  const isHovered = hoveredIndicators.some(
                    (ind: BiasIndicator) => ind.displayIndex === displayIndex
                  );
                  
                  if (isHovered) {
                    markerElement.classList.add('highlighted');
                  }
                }
              });
            }
          };
          
          editorView.dom.addEventListener('mousemove', handleMouseMove);
          
          return {
            destroy() {
              editorView.dom.removeEventListener('mousemove', handleMouseMove);
            }
          };
        }
      }),
    ];
  },
});
