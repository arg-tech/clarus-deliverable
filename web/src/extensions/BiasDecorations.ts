import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Selection } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import type { BiasIndicator } from '../types';

// Create a global plugin key for bias decorations
export const biasDecorationsKey = new PluginKey('biasDecorations');

interface BiasHighlightOptions {
  HTMLAttributes: Record<string, unknown>;
  onUpdate?: (indicators: BiasIndicator[]) => void;
}

interface BiasHighlightStorage {
  indicators: BiasIndicator[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    biasDecorations: {
      setBiasIndicators: (indicators: BiasIndicator[], normalizeCharacterPositions?: boolean) => ReturnType;
      clearBiasIndicators: () => ReturnType;
      removeBiasIndicator: (index: number) => ReturnType;
      removeBiasIndicatorAtPosition: (position: number) => ReturnType;
    };
  }
}

export const BiasDecorations = Extension.create<BiasHighlightOptions, BiasHighlightStorage>({
  name: 'biasDecorations',

  addOptions() {
    return {
      HTMLAttributes: {},
      onUpdate: undefined,
    };
  },

  addStorage() {
    return {
      indicators: [],
    };
  },

  addProseMirrorPlugins() {
    const { editor } = this;
    
    // Helper function: Map indicator positions when document changes
    const mapIndicatorPositions = (indicators: BiasIndicator[], mapping: Mapping): {
      indicators: BiasIndicator[];
      changed: boolean;
    } => {
      const updatedIndicators = [...indicators];
      let positionsChanged = false;
      
      // Map each indicator's positions to their new locations
      for (let i = 0; i < updatedIndicators.length; i++) {
        const indicator = updatedIndicators[i];
        const oldStart = indicator.character_positions.start;
        const oldEnd = indicator.character_positions.end;
        
        // Use the mapping to get the new positions
        const newStart = mapping.map(oldStart);
        const newEnd = mapping.map(oldEnd);
        
        // Update the indicator with new positions
        if (newStart !== oldStart || newEnd !== oldEnd) {
          updatedIndicators[i] = {
            ...indicator,
            character_positions: {
              start: newStart,
              end: newEnd
            }
          };
          positionsChanged = true;
        }
      }
      
      return {
        indicators: updatedIndicators,
        changed: positionsChanged
      };
    };
    
    // Helper function: Mark indicators as outdated when user is typing inside
    const removeEditedIndicators = (indicators: BiasIndicator[], selection: Selection): {
      indicators: BiasIndicator[];
      changed: boolean;
      outdatedIndicators: BiasIndicator[];
    } => {
      if (!selection || !selection.empty) {
        return { indicators, changed: false, outdatedIndicators: [] };
      }
      
      const updatedIndicators = [...indicators];
      const indicatorsToOutdate = new Set<number>();
      const outdatedIndicators: BiasIndicator[] = [];
      
      // Find indicators where cursor is inside the range
      for (let i = 0; i < updatedIndicators.length; i++) {
        const indicator = updatedIndicators[i];
        const start = indicator.character_positions.start;
        const end = indicator.character_positions.end;
        
        // Check if cursor is strictly inside (after start position)
        if (selection.from > start && selection.from <= end) {
          indicatorsToOutdate.add(i);
        }
      }
      
      // No indicators to mark as outdated
      if (indicatorsToOutdate.size === 0) {
        return { indicators: updatedIndicators, changed: false, outdatedIndicators: [] };
      }
      
      // Mark indicators as outdated (not removed from editor display)
      const indicesToUpdate = [...indicatorsToOutdate].sort((a, b) => b - a);
      for (const index of indicesToUpdate) {
        // Mark the indicator as outdated
        const outdatedIndicator = {
          ...updatedIndicators[index],
          outdated: true
        };
        updatedIndicators[index] = outdatedIndicator;
        outdatedIndicators.push(outdatedIndicator);
      }
      
      return {
        indicators: updatedIndicators,
        changed: true,
        outdatedIndicators
      };
    };
    
    // Helper function: Remove invalid indicators (no text or outside doc)
    const removeInvalidIndicators = (indicators: BiasIndicator[], doc: { content: { size: number } }): {
      indicators: BiasIndicator[];
      changed: boolean;
    } => {
      const docSize = doc.content.size;
      const updatedIndicators = [...indicators];
      const indicatorsToRemove = new Set<number>();
      
      // Find indicators that are invalid
      for (let i = 0; i < updatedIndicators.length; i++) {
        const indicator = updatedIndicators[i];
        const start = indicator.character_positions.start;
        const end = indicator.character_positions.end;
        
        // Remove indicators if they are:
        // 1. Empty or negative length (start >= end)
        // 2. Outside document bounds (start < 1 or end > docSize)
        if (start >= end || start < 1 || end > docSize) {
          indicatorsToRemove.add(i);
        }
      }
      
      // No indicators to remove
      if (indicatorsToRemove.size === 0) {
        return { indicators: updatedIndicators, changed: false };
      }
      
      // Remove indicators in reverse order (to avoid index shifting)
      const indicesToRemove = [...indicatorsToRemove].sort((a, b) => b - a);
      for (const index of indicesToRemove) {
        updatedIndicators.splice(index, 1);
      }
      
      return {
        indicators: updatedIndicators,
        changed: true
      };
    };
    
    // Create decorations from indicators
    const createDecorations = (indicators: BiasIndicator[]): Decoration[] => {
      if (!indicators || !indicators.length) {
        return [];
      }
      
      const decorations: Decoration[] = [];
      
      // Create an array of all indicators with their indices, filtering out outdated indicators
      const allIndicators = indicators
        .filter(indicator => !indicator.outdated) // Only show active indicators in the editor
        .map((indicator, index) => ({
          indicator,
          index
        }));
      
      // Sort by start position
      allIndicators.sort((a, b) => a.indicator.character_positions.start - b.indicator.character_positions.start);
      
      // Create decorations
      let nextAvailableIndex = 1;
      
      // Create a unique decoration for each indicator, regardless of starting position
      allIndicators.forEach(({ indicator, index }) => {
        const from = indicator.character_positions.start;
        const to = indicator.character_positions.end;
        
        // Create a unique decoration for each indicator
        // To avoid z-index conflicts with overlapping highlights,
        // we'll add a custom attribute to distinguish them
        const spanDecoration = Decoration.inline(from, to, {
          class: 'bias-highlight',
          'data-bias-index': index.toString()
        });
        
        decorations.push(spanDecoration);
        
        // Add the superscript widget
        const superscriptDecoration = Decoration.widget(to, () => {
          const wrapper = document.createElement('span');
          wrapper.className = 'bias-marker-wrapper';
          
          const sup = document.createElement('sup');
          sup.className = 'bias-indicator-marker';
          
          // Use displayIndex if available, otherwise use and increment nextAvailableIndex
          const displayIndex = indicator.displayIndex || nextAvailableIndex++;
          sup.textContent = `${displayIndex}`;

          // Store relevant data attributes, later used for hover popups
          sup.dataset.biasIndicatorKey = indicator.bias_indicator_key;
          sup.dataset.detectedPhrase = indicator.detected_phrase;
          sup.dataset.confidence = indicator.confidence || '';
          sup.dataset.index = displayIndex.toString();
          sup.dataset.charStart = indicator.character_positions.start.toString();
          sup.dataset.charEnd = indicator.character_positions.end.toString();
          
          wrapper.appendChild(sup);
          return wrapper;
        });
        
        decorations.push(superscriptDecoration);
      });
      
      return decorations;
    };

    return [
      new Plugin({
        key: biasDecorationsKey,
        
        // State management for the plugin
        state: {
          init() {
            return {
              decorationSet: DecorationSet.empty,
              lastUpdateVersion: 0
            };
          },
          
          apply(tr, prevPluginState) {
            // If the document has changed, remap the decoration positions
            const mappedDecorations = prevPluginState.decorationSet.map(tr.mapping, tr.doc);
            
            // If indicators have been updated by a command, rebuild all decorations
            if (tr.getMeta(biasDecorationsKey)) {
              const decorations = createDecorations(editor.storage.biasDecorations.indicators);
              return {
                decorationSet: DecorationSet.create(tr.doc, decorations),
                lastUpdateVersion: tr.time
              };
            }
            
            // Handle document changes (typing, deletions, etc.)
            if (tr.docChanged) {
              let indicators = [...editor.storage.biasDecorations.indicators];
              let indicatorsChanged = false;
              
              // 1. Update positions of all indicators using the mapping
              const mappingResult = mapIndicatorPositions(indicators, tr.mapping);
              indicators = mappingResult.indicators;
              indicatorsChanged = mappingResult.changed;
              
              // 2. Mark as outdated indicators where user is typing inside them
              const removalResult = removeEditedIndicators(indicators, tr.selection);
              indicators = removalResult.indicators;
              indicatorsChanged = indicatorsChanged || removalResult.changed;
              
              // 3. Remove indicators that are now invalid (outside document or zero length)
              const invalidResult = removeInvalidIndicators(indicators, tr.doc);
              indicators = invalidResult.indicators;
              indicatorsChanged = indicatorsChanged || invalidResult.changed;
              
              // 4. If we made any changes to the indicators, update storage and recreate decorations
              if (indicatorsChanged) {
                editor.storage.biasDecorations.indicators = indicators;
                
                // Notify about indicator changes via a custom event
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('biasIndicatorsUpdated', {
                    detail: { indicators }
                  }));
                }
                
                const decorations = createDecorations(indicators);
                return {
                  decorationSet: DecorationSet.create(tr.doc, decorations),
                  lastUpdateVersion: tr.time
                };
              }
            }
            
            // If no changes were made to indicators, just return the mapped decorations
            return {
              decorationSet: mappedDecorations,
              lastUpdateVersion: prevPluginState.lastUpdateVersion
            };
          }
        },
        
        // This is called when the editor updates and provides the decorations
        props: {
          decorations(state) {
            return biasDecorationsKey.getState(state).decorationSet;
          }
        }
      })
    ];
  },

  addCommands() {
    return {
      setBiasIndicators: (indicators: BiasIndicator[], normalizeCharacterPositions = true) => ({ editor, tr }) => {
        // Clear existing indicators
        editor.storage.biasDecorations.indicators = [];

        const sortedIndicators = [...indicators].sort((a, b) =>
            a.character_positions.end - b.character_positions.end
        );
        
        // Get the next available index for new indicators
        const currentIndicators = editor.storage.biasDecorations.indicators || [];
        const maxDisplayIndex = currentIndicators.reduce((max: number, ind: BiasIndicator) => 
          Math.max(max, ind.displayIndex || 0), 0);
        let nextDisplayIndex = maxDisplayIndex + 1;
        
        // Adjust positions for ProseMirror's 1-based indexing
        const adjustedIndicators = sortedIndicators.map(indicator => {
          const start = normalizeCharacterPositions
            ? (indicator.character_positions.start === 0 ? 1 : indicator.character_positions.start + 1)
            : indicator.character_positions.start;
          const end = normalizeCharacterPositions
            ? Math.max(indicator.character_positions.end + 1, start + 1)
            : indicator.character_positions.end;
          
          // Assign displayIndex if not already present
          const displayIndex = indicator.displayIndex || nextDisplayIndex++;
          
          return {
            ...indicator,
            character_positions: {
              start,
              end
            },
            displayIndex
          };
        });
        
        editor.storage.biasDecorations.indicators = adjustedIndicators;
        
        // Notify about indicator changes via a custom event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('biasIndicatorsUpdated', {
            detail: { indicators: adjustedIndicators }
          }));
        }
        
        // Dispatch transaction to notify the plugin that indicators have changed
        if (tr) {
          tr.setMeta(biasDecorationsKey, true);
          return true;
        }
        
        // If no transaction is provided, dispatch it separately
        editor.view.dispatch(
          editor.state.tr.setMeta(biasDecorationsKey, true)
        );
        
        return true;
      },
      clearBiasIndicators: () => ({ editor, tr }) => {
        editor.storage.biasDecorations.indicators = [];
        
        // Notify about indicator changes via a custom event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('biasIndicatorsUpdated', {
            detail: { indicators: [] }
          }));
        }
        
        // Dispatch transaction to notify the plugin that indicators have changed
        if (tr) {
          tr.setMeta(biasDecorationsKey, true);
          return true;
        }
        
        // If no transaction is provided, dispatch it separately
        editor.view.dispatch(
          editor.state.tr.setMeta(biasDecorationsKey, true)
        );
        
        return true;
      },
      // New command to remove a single bias indicator
      removeBiasIndicator: (index: number) => ({ editor, tr }) => {
        const indicators = [...editor.storage.biasDecorations.indicators];
        
        // Make sure the index is valid
        if (index >= 0 && index < indicators.length) {
          // When removing an indicator, we just remove it directly
          // without renumbering the others, as displayIndex values 
          // are stored directly in each indicator
          indicators.splice(index, 1);
          editor.storage.biasDecorations.indicators = indicators;
          
          // Notify about indicator changes via a custom event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('biasIndicatorsUpdated', {
              detail: { indicators }
            }));
          }
          
          // Dispatch transaction to notify the plugin that indicators have changed
          if (tr) {
            tr.setMeta(biasDecorationsKey, true);
            return true;
          }
          
          // If no transaction is provided, dispatch it separately
          editor.view.dispatch(
            editor.state.tr.setMeta(biasDecorationsKey, true)
          );
          
          return true;
        }
        
        return false;
      },
      // New command to remove a bias indicator at a specific position
      removeBiasIndicatorAtPosition: (position: number) => ({ editor, tr }) => {
        const indicators = [...editor.storage.biasDecorations.indicators];
        let indicatorRemoved = false;
        
        // Find indicators at the position and remove them
        // We loop from the end to avoid index shifting issues
        for (let i = indicators.length - 1; i >= 0; i--) {
          const indicator = indicators[i];
          if (position >= indicator.character_positions.start && 
              position <= indicator.character_positions.end) {
            // Remove the indicator while preserving the displayIndex of others
            indicators.splice(i, 1);
            indicatorRemoved = true;
          }
        }
        
        if (indicatorRemoved) {
          editor.storage.biasDecorations.indicators = indicators;
          
          // Notify about indicator changes via a custom event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('biasIndicatorsUpdated', {
              detail: { indicators }
            }));
          }
          
          // Dispatch transaction to notify the plugin that indicators have changed
          if (tr) {
            tr.setMeta(biasDecorationsKey, true);
            return true;
          }
          
          // If no transaction is provided, dispatch it separately
          editor.view.dispatch(
            editor.state.tr.setMeta(biasDecorationsKey, true)
          );
          
          return true;
        }
        
        return false;
      },
      

    };
  },
});
