// PDF Text Extraction Content Script - Moonlight Style
import * as pdfjsLib from 'pdfjs-dist';

interface PDFContent {
  title: string;
  url: string;
  textContent: string;
  wordCount: number;
  pageCount: number;
  fileSize?: string;
}

class PDFTextExtractor {
  private extractedContent: PDFContent | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Check if this is a PDF page
    if (!this.isPDFPage()) {
      console.log('Not a PDF page, skipping injection');
      return;
    }

    console.log('PDF page detected, extracting text...');

    // Extract text (don't inject custom viewer, use Chrome's default)
    await this.extractBeforeInjection();

    console.log('Text extraction complete. Using Chrome default PDF viewer.');
  }

  private isPDFPage(): boolean {
    const url = window.location.href;
    const contentType = (document as any).contentType;

    return (
      contentType === 'application/pdf' ||
      url.endsWith('.pdf') ||
      url.includes('.pdf?') ||
      document.querySelector('embed[type="application/pdf"]') !== null
    );
  }

  private async extractBeforeInjection() {
    const url = window.location.href;

    try {
      // Request extraction from background script (has file:// access)
      console.log('Requesting extraction from background script...');

      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'extractPDFFromBackground',
            url: url
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Background request failed:', chrome.runtime.lastError.message);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(response);
            }
          }
        );
      });

      if (response.success && response.data) {
        this.extractedContent = response.data;
        console.log('Extraction complete:', this.extractedContent?.wordCount || 0, 'words');

        // Send to background for storage
        if (this.extractedContent) {
          this.sendToBackground(this.extractedContent);
        }
      } else {
        throw new Error(response.error || 'Background extraction failed');
      }
    } catch (error) {
      console.error('Extraction failed:', error);
      this.extractedContent = {
        title: 'PDF Document',
        url: url,
        textContent: 'Failed to extract text from PDF',
        wordCount: 0,
        pageCount: 1
      };
    }
  }


  private sendToBackground(content: PDFContent) {
    chrome.runtime.sendMessage(
      {
        action: 'contentReady',
        data: content
      },
      (_response) => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to send to background:', chrome.runtime.lastError.message);
        } else {
          console.log('Content sent to background successfully');
        }
      }
    );
  }

}

// Fallback extractor (simplified version of original)
class PDFTextExtractorFallback {
  private pdfjsLib: any = null;

  constructor() {
    this.initializePDFJS();
  }

  private async initializePDFJS() {
    try {
      this.pdfjsLib = pdfjsLib;
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
    } catch (error) {
      console.error('Failed to load PDF.js:', error);
    }
  }

  async extractPDFContent(): Promise<PDFContent> {
    const url = window.location.href;

    // Try PDF.js extraction with ArrayBuffer
    if (this.pdfjsLib) {
      try {
        return await this.extractUsingPDFJSWithArrayBuffer(url);
      } catch (error) {
        console.warn('PDF.js extraction with ArrayBuffer failed, trying URL method:', error);
      }
    }

    // Try PDF.js with URL (for HTTP/HTTPS)
    if (this.pdfjsLib && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        return await this.extractUsingPDFJS(url);
      } catch (error) {
        console.warn('PDF.js URL extraction failed:', error);
      }
    }

    // Fallback text extraction
    return this.extractFallbackText();
  }

  private async extractUsingPDFJSWithArrayBuffer(url: string): Promise<PDFContent> {
    console.log('Extracting PDF using ArrayBuffer method...');
    const title = this.extractTitleFromURL(url);

    // Fetch PDF as ArrayBuffer
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch PDF');

    const arrayBuffer = await response.arrayBuffer();
    console.log('PDF fetched, size:', arrayBuffer.byteLength, 'bytes');

    // Load PDF document from ArrayBuffer
    const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    console.log('PDF loaded, pages:', pageCount);

    let fullText = '';
    // Extract all pages (not just first 10)
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';

      if (i % 5 === 0) {
        console.log(`Extracted ${i}/${pageCount} pages...`);
      }
    }

    console.log('Extraction complete, total text length:', fullText.length);

    return {
      title,
      url,
      textContent: fullText.substring(0, 50000), // Increase limit to 50k chars
      wordCount: this.countWords(fullText),
      pageCount
    };
  }

  private async extractUsingPDFJS(url: string): Promise<PDFContent> {
    try {
      const title = this.extractTitleFromURL(url);
      const pdf = await this.pdfjsLib.getDocument(url).promise;
      const pageCount = pdf.numPages;

      let fullText = '';
      const maxPages = Math.min(pageCount, 10);

      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
      }

      return {
        title,
        url,
        textContent: fullText.substring(0, 10000),
        wordCount: this.countWords(fullText),
        pageCount
      };
    } catch (error) {
      console.error('PDF.js extraction failed:', error);
      return this.extractFallbackText();
    }
  }

  private extractFallbackText(): PDFContent {
    const url = window.location.href;
    const title = this.extractTitleFromURL(url);
    const bodyText = document.body.textContent || '';
    const cleanText = bodyText.replace(/\s+/g, ' ').trim();

    return {
      title,
      url,
      textContent: cleanText.substring(0, 1000) || 'No text could be extracted from this PDF.',
      wordCount: this.countWords(cleanText),
      pageCount: 1
    };
  }

  private extractTitleFromURL(url: string): string {
    try {
      const urlPath = new URL(url).pathname;
      const fileName = urlPath.split('/').pop() || '';
      return decodeURIComponent(fileName.replace('.pdf', ''));
    } catch {
      return 'PDF Document';
    }
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
}

// Initialize
new PDFTextExtractor();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((
  request: { action: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean; data?: PDFContent; error?: string }) => void
): boolean => {
  if (request.action === 'extractContent') {
    // Try to extract again (this shouldn't normally be needed with the new approach)
    const extractor = new PDFTextExtractorFallback();
    extractor.extractPDFContent()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => {
        console.error('PDF extraction error:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    return true; // Keep message channel open for async response
  }
  return false;
});
