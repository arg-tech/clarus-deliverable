import type { Editor } from '@tiptap/react';
import { extractPdfToHtml } from '../utils/pdfExtractor';

export function usePdfUpload(
  editor: Editor | null,
  onError: (errorMessage: string) => void
) {
  return async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      return;
    }
    
    if (!editor) {
      console.warn('Editor not ready yet');
      onError('Editor not ready. Please try again.');
      return;
    }
    
    try {
      const htmlContent = await extractPdfToHtml(file);
      editor.commands.setContent(htmlContent);
      console.log('PDF loaded successfully:', file.name);
    } catch (error) {
      console.error('Failed to load PDF:', error);
      onError('Failed to load PDF file');
    } finally {
      // Reset input so the same file can be uploaded again
      event.target.value = '';
    }
  };
}
