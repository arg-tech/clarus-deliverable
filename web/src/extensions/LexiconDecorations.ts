import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Selection } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import type { LexiconTerm } from '../types';

// Create a global plugin key for lexicon decorations
export const lexiconDecorationsKey = new PluginKey('lexiconDecorations');

interface LexiconHighlightOptions {
  HTMLAttributes: Record<string, unknown>;
  onUpdate?: (terms: LexiconTerm[]) => void;
}

interface LexiconHighlightStorage {
  terms: LexiconTerm[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lexiconDecorations: {
      setLexiconTerms: (terms: LexiconTerm[]) => ReturnType;
      clearLexiconTerms: () => ReturnType;
      removeLexiconTerm: (index: number) => ReturnType;
      removeLexiconTermAtPosition: (position: number) => ReturnType;
    };
  }
}

export const LexiconDecorations = Extension.create<LexiconHighlightOptions, LexiconHighlightStorage>({
  name: 'lexiconDecorations',

  addOptions() {
    return {
      HTMLAttributes: {},
      onUpdate: undefined,
    };
  },

  addStorage() {
    return {
      terms: [],
    };
  },

  addProseMirrorPlugins() {
    const { editor } = this;
    
    // Helper function: Map term positions when document changes
    const mapTermPositions = (terms: LexiconTerm[], mapping: Mapping): {
      terms: LexiconTerm[];
      changed: boolean;
    } => {
      const updatedTerms = [...terms];
      let positionsChanged = false;
      
      // Map each term's positions to their new locations
      for (let i = 0; i < updatedTerms.length; i++) {
        const term = updatedTerms[i];
        const oldStart = term.character_positions.start;
        const oldEnd = term.character_positions.end;
        
        // Use the mapping to get the new positions
        const newStart = mapping.map(oldStart);
        const newEnd = mapping.map(oldEnd);
        
        // Update the term with new positions
        if (newStart !== oldStart || newEnd !== oldEnd) {
          updatedTerms[i] = {
            ...term,
            character_positions: {
              start: newStart,
              end: newEnd
            }
          };
          positionsChanged = true;
        }
      }
      
      return {
        terms: updatedTerms,
        changed: positionsChanged
      };
    };
    
    // Helper function: Mark terms as outdated when user is typing inside
    const removeEditedTerms = (terms: LexiconTerm[], selection: Selection): {
      terms: LexiconTerm[];
      changed: boolean;
      outdatedTerms: LexiconTerm[];
    } => {
      if (!selection || !selection.empty) {
        return { terms, changed: false, outdatedTerms: [] };
      }
      
      const updatedTerms = [...terms];
      const termsToOutdate = new Set<number>();
      const outdatedTerms: LexiconTerm[] = [];
      
      // Find terms where cursor is inside the range
      for (let i = 0; i < updatedTerms.length; i++) {
        const term = updatedTerms[i];
        const start = term.character_positions.start;
        const end = term.character_positions.end;
        
        // Check if cursor is strictly inside (after start position)
        if (selection.from > start && selection.from <= end) {
          termsToOutdate.add(i);
        }
      }
      
      // No terms to mark as outdated
      if (termsToOutdate.size === 0) {
        return { terms: updatedTerms, changed: false, outdatedTerms: [] };
      }
      
      // Mark terms as outdated (not removed from editor display)
      const indicesToUpdate = [...termsToOutdate].sort((a, b) => b - a);
      for (const index of indicesToUpdate) {
        // Mark the term as outdated
        const outdatedTerm = {
          ...updatedTerms[index],
          outdated: true
        };
        updatedTerms[index] = outdatedTerm;
        outdatedTerms.push(outdatedTerm);
      }
      
      return {
        terms: updatedTerms,
        changed: true,
        outdatedTerms
      };
    };
    
    // Helper function: Remove invalid terms (no text or outside doc)
    const removeInvalidTerms = (terms: LexiconTerm[], doc: { content: { size: number } }): {
      terms: LexiconTerm[];
      changed: boolean;
    } => {
      const docSize = doc.content.size;
      const updatedTerms = [...terms];
      const termsToRemove = new Set<number>();
      
      // Find terms that are invalid
      for (let i = 0; i < updatedTerms.length; i++) {
        const term = updatedTerms[i];
        const start = term.character_positions.start;
        const end = term.character_positions.end;
        
        // Remove terms if they are:
        // 1. Empty or negative length (start >= end)
        // 2. Outside document bounds (start < 1 or end > docSize)
        if (start >= end || start < 1 || end > docSize) {
          termsToRemove.add(i);
        }
      }
      
      // No terms to remove
      if (termsToRemove.size === 0) {
        return { terms: updatedTerms, changed: false };
      }
      
      // Remove terms in reverse order (to avoid index shifting)
      const indicesToRemove = [...termsToRemove].sort((a, b) => b - a);
      for (const index of indicesToRemove) {
        updatedTerms.splice(index, 1);
      }
      
      return {
        terms: updatedTerms,
        changed: true
      };
    };
    
    // Create decorations from terms
    const createDecorations = (terms: LexiconTerm[]): Decoration[] => {
      if (!terms || !terms.length) {
        return [];
      }
      
      const decorations: Decoration[] = [];
      
      // Create an array of all terms with their indices, filtering out outdated terms
      const allTerms = terms
        .filter(term => !term.outdated) // Only show active terms in the editor
        .map((term, index) => ({
          term,
          index
        }));
      
      // Sort by start position
      allTerms.sort((a, b) => a.term.character_positions.start - b.term.character_positions.start);
      
      // Create decorations
      let nextAvailableIndex = 1;
      
      // Create a unique decoration for each term
      allTerms.forEach(({ term, index }) => {
        const from = term.character_positions.start;
        const to = term.character_positions.end;
        
        // Create a unique decoration for each term with blue highlighting
        const spanDecoration = Decoration.inline(from, to, {
          class: 'lexicon-highlight',
          'data-lexicon-index': index.toString()
        });
        
        decorations.push(spanDecoration);
        
        // Add the superscript widget
        const superscriptDecoration = Decoration.widget(to, () => {
          const wrapper = document.createElement('span');
          wrapper.className = 'lexicon-marker-wrapper';
          
          const sup = document.createElement('sup');
          sup.className = 'lexicon-term-marker';
          
          // Use displayIndex if available, otherwise use and increment nextAvailableIndex
          const displayIndex = term.displayIndex || nextAvailableIndex++;
          sup.textContent = `${displayIndex}`;

          // Store relevant data attributes, later used for hover popups
          sup.dataset.word = term.word;
          sup.dataset.definition = term.definition || '';
          sup.dataset.usageExample = term.usage_example;
          sup.dataset.index = displayIndex.toString();
          sup.dataset.charStart = term.character_positions.start.toString();
          sup.dataset.charEnd = term.character_positions.end.toString();
          
          wrapper.appendChild(sup);
          return wrapper;
        });
        
        decorations.push(superscriptDecoration);
      });
      
      return decorations;
    };

    return [
      new Plugin({
        key: lexiconDecorationsKey,
        
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
            
            // If terms have been updated by a command, rebuild all decorations
            if (tr.getMeta(lexiconDecorationsKey)) {
              const decorations = createDecorations(editor.storage.lexiconDecorations.terms);
              return {
                decorationSet: DecorationSet.create(tr.doc, decorations),
                lastUpdateVersion: tr.time
              };
            }
            
            // Handle document changes (typing, deletions, etc.)
            if (tr.docChanged) {
              let terms = [...editor.storage.lexiconDecorations.terms];
              let termsChanged = false;
              
              // 1. Update positions of all terms using the mapping
              const mappingResult = mapTermPositions(terms, tr.mapping);
              terms = mappingResult.terms;
              termsChanged = mappingResult.changed;
              
              // 2. Mark as outdated terms where user is typing inside them
              const removalResult = removeEditedTerms(terms, tr.selection);
              terms = removalResult.terms;
              termsChanged = termsChanged || removalResult.changed;
              
              // 3. Remove terms that are now invalid (outside document or zero length)
              const invalidResult = removeInvalidTerms(terms, tr.doc);
              terms = invalidResult.terms;
              termsChanged = termsChanged || invalidResult.changed;
              
              // 4. If we made any changes to the terms, update storage and recreate decorations
              if (termsChanged) {
                editor.storage.lexiconDecorations.terms = terms;
                
                // Notify about term changes via a custom event
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('lexiconTermsUpdated', {
                    detail: { terms }
                  }));
                }
                
                const decorations = createDecorations(terms);
                return {
                  decorationSet: DecorationSet.create(tr.doc, decorations),
                  lastUpdateVersion: tr.time
                };
              }
            }
            
            // If no changes were made to terms, just return the mapped decorations
            return {
              decorationSet: mappedDecorations,
              lastUpdateVersion: prevPluginState.lastUpdateVersion
            };
          }
        },
        
        // This is called when the editor updates and provides the decorations
        props: {
          decorations(state) {
            return lexiconDecorationsKey.getState(state).decorationSet;
          }
        }
      })
    ];
  },

  addCommands() {
    return {
      setLexiconTerms: (terms: LexiconTerm[]) => ({ editor, tr }) => {
        // Clear existing terms
        editor.storage.lexiconDecorations.terms = [];
        
        // Get the next available index for new terms
        const currentTerms = editor.storage.lexiconDecorations.terms || [];
        const maxDisplayIndex = currentTerms.reduce((max: number, term: LexiconTerm) => 
          Math.max(max, term.displayIndex || 0), 0);
        let nextDisplayIndex = maxDisplayIndex + 1;
        
        // Adjust positions for ProseMirror's 1-based indexing
        const adjustedTerms = terms.map(term => {
          // Ensure positions are always at least 1 (ProseMirror's minimum position)
          // Special handling for position 0, which should be 1 in ProseMirror
          const start = term.character_positions.start === 0 ? 1 : term.character_positions.start + 1;
          const end = Math.max(term.character_positions.end + 1, start + 1);
          
          // Assign displayIndex if not already present
          const displayIndex = term.displayIndex || nextDisplayIndex++;
          
          return {
            ...term,
            character_positions: {
              start,
              end
            },
            displayIndex
          };
        });
        
        editor.storage.lexiconDecorations.terms = adjustedTerms;
        
        // Notify about term changes via a custom event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lexiconTermsUpdated', {
            detail: { terms: adjustedTerms }
          }));
        }
        
        // Dispatch transaction to notify the plugin that terms have changed
        if (tr) {
          tr.setMeta(lexiconDecorationsKey, true);
          return true;
        }
        
        // If no transaction is provided, dispatch it separately
        editor.view.dispatch(
          editor.state.tr.setMeta(lexiconDecorationsKey, true)
        );
        
        return true;
      },
      clearLexiconTerms: () => ({ editor, tr }) => {
        editor.storage.lexiconDecorations.terms = [];
        
        // Notify about term changes via a custom event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lexiconTermsUpdated', {
            detail: { terms: [] }
          }));
        }
        
        // Dispatch transaction to notify the plugin that terms have changed
        if (tr) {
          tr.setMeta(lexiconDecorationsKey, true);
          return true;
        }
        
        // If no transaction is provided, dispatch it separately
        editor.view.dispatch(
          editor.state.tr.setMeta(lexiconDecorationsKey, true)
        );
        
        return true;
      },
      // New command to remove a single lexicon term
      removeLexiconTerm: (index: number) => ({ editor, tr }) => {
        const terms = [...editor.storage.lexiconDecorations.terms];
        
        // Make sure the index is valid
        if (index >= 0 && index < terms.length) {
          // When removing a term, we just remove it directly
          // without renumbering the others, as displayIndex values 
          // are stored directly in each term
          terms.splice(index, 1);
          editor.storage.lexiconDecorations.terms = terms;
          
          // Notify about term changes via a custom event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('lexiconTermsUpdated', {
              detail: { terms }
            }));
          }
          
          // Dispatch transaction to notify the plugin that terms have changed
          if (tr) {
            tr.setMeta(lexiconDecorationsKey, true);
            return true;
          }
          
          // If no transaction is provided, dispatch it separately
          editor.view.dispatch(
            editor.state.tr.setMeta(lexiconDecorationsKey, true)
          );
          
          return true;
        }
        
        return false;
      },
      // New command to remove a lexicon term at a specific position
      removeLexiconTermAtPosition: (position: number) => ({ editor, tr }) => {
        const terms = [...editor.storage.lexiconDecorations.terms];
        let termRemoved = false;
        
        // Find terms at the position and remove them
        // We loop from the end to avoid index shifting issues
        for (let i = terms.length - 1; i >= 0; i--) {
          const term = terms[i];
          if (position >= term.character_positions.start && 
              position <= term.character_positions.end) {
            // Remove the term while preserving the displayIndex of others
            terms.splice(i, 1);
            termRemoved = true;
          }
        }
        
        if (termRemoved) {
          editor.storage.lexiconDecorations.terms = terms;
          
          // Notify about term changes via a custom event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('lexiconTermsUpdated', {
              detail: { terms }
            }));
          }
          
          // Dispatch transaction to notify the plugin that terms have changed
          if (tr) {
            tr.setMeta(lexiconDecorationsKey, true);
            return true;
          }
          
          // If no transaction is provided, dispatch it separately
          editor.view.dispatch(
            editor.state.tr.setMeta(lexiconDecorationsKey, true)
          );
          
          return true;
        }
        
        return false;
      },
    };
  },
});
