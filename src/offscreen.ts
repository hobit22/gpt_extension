// Offscreen document for PDF processing
// This runs in a regular DOM context, not a Service Worker
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

interface PDFContent {
  title: string;
  url: string;
  textContent: string;
  wordCount: number;
  pageCount: number;
}

console.log('Offscreen document loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((
  message: { action: string; url?: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): boolean => {
  if (message.action === 'extractPDFOffscreen' && message.url) {
    console.log('Offscreen: Extracting PDF from', message.url);
    extractPDF(message.url)
      .then(data => {
        console.log('Offscreen: Extraction complete,', data.wordCount, 'words');
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('Offscreen: Extraction failed:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    return true; // Keep channel open for async response
  }
  return false;
});

async function extractPDF(url: string): Promise<PDFContent> {
  console.log('Offscreen: Fetching PDF...');

  // Fetch PDF
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch PDF');

  const arrayBuffer = await response.arrayBuffer();
  console.log('Offscreen: PDF fetched, size:', arrayBuffer.byteLength, 'bytes');

  // Load PDF document
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  console.log('Offscreen: PDF loaded, pages:', pageCount);

  let fullText = '';

  // Extract text from all pages
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n\n';

    if (i % 5 === 0) {
      console.log(`Offscreen: Extracted ${i}/${pageCount} pages...`);
    }
  }

  const title = extractTitleFromURL(url);
  const wordCount = countWords(fullText);

  return {
    title,
    url,
    textContent: fullText.substring(0, 50000),
    wordCount,
    pageCount
  };
}

function extractTitleFromURL(url: string): string {
  try {
    const urlPath = new URL(url).pathname;
    const fileName = urlPath.split('/').pop() || '';
    return decodeURIComponent(fileName.replace('.pdf', ''));
  } catch {
    return 'PDF Document';
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}
