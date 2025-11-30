import { PDFParse } from 'pdf-parse';

// Workaround to make pdf-parse work in the browser environment
PDFParse.setWorker('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs');

export async function extractPdfToHtml(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const parser = new PDFParse({ data: arrayBuffer });
    const result = await parser.getText();
    
    return escapeHtml(result.text)
      // Remove page markers like "-- 1 of 2 --"
      .replace(/\n\n--\s*\d+\s+of\s+\d+\s*--\n\n/g, '\n');
  } catch (error) {
    console.error('Failed to extract text from PDF:', error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
