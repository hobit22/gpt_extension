// PDF Text Extraction Content Script
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
  private pdfjsLib: any = null;
  private debugMode: boolean = true;
  private mutationObserver: MutationObserver | null = null;
  private domChangeLog: Array<{timestamp: number, type: string, details: any}> = [];

  constructor() {
    this.initializePDFJS();
    if (this.debugMode) {
      this.logEnvironmentInfo();
      this.setupDOMChangeDetection();
    }
  }

  private setupDOMChangeDetection(): void {
    console.log('🔍 Setting up DOM change detection...');

    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const logEntry = {
          timestamp: Date.now(),
          type: mutation.type,
          details: {
            target: mutation.target.nodeName,
            targetId: (mutation.target as Element).id,
            targetClass: (mutation.target as Element).className,
            addedNodes: mutation.addedNodes.length,
            removedNodes: mutation.removedNodes.length,
            attributeName: mutation.attributeName,
            oldValue: mutation.oldValue
          }
        };

        this.domChangeLog.push(logEntry);

        // Log significant changes
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              const hasText = element.textContent && element.textContent.length > 50;
              const isPDFRelated = element.tagName === 'EMBED' ||
                                  element.className.includes('textLayer') ||
                                  element.className.includes('page') ||
                                  element.id.includes('viewer');

              if (hasText || isPDFRelated) {
                console.log('🆕 Significant DOM addition:', {
                  tagName: element.tagName,
                  id: element.id,
                  className: element.className,
                  textLength: element.textContent?.length || 0,
                  textPreview: element.textContent?.substring(0, 100)
                });
              }
            }
          });
        }
      });
    });

    // Observe the entire document for changes
    this.mutationObserver.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true
    });

    console.log('✅ DOM change detection active');
  }

  private logDOMChangesSummary(): void {
    if (this.domChangeLog.length === 0) {
      console.log('📊 No DOM changes detected during extraction');
      return;
    }

    console.log(`📊 DOM Changes Summary (${this.domChangeLog.length} changes):`);

    const changeTypes = this.domChangeLog.reduce((acc, log) => {
      acc[log.type] = (acc[log.type] || 0) + 1;
      return acc;
    }, {} as {[key: string]: number});

    console.log('Change types:', changeTypes);

    // Show recent significant changes
    const recentChanges = this.domChangeLog.slice(-10);
    console.log('Recent changes:', recentChanges);
  }

  private stopDOMChangeDetection(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      console.log('🛑 DOM change detection stopped');
      this.logDOMChangesSummary();
    }
  }

  private logEnvironmentInfo(): void {
    console.log('=== PDF Text Extractor Debug Info ===');
    console.log('URL:', window.location.href);
    console.log('User Agent:', navigator.userAgent);
    console.log('Document ready state:', document.readyState);
    console.log('Document title:', document.title);
    console.log('Window size:', window.innerWidth, 'x', window.innerHeight);
    console.log('=====================================');
  }

  private analyzeCurrentDOM(): void {
    console.log('\n=== DOM Structure Analysis ===');

    // Basic document info
    console.log('Document info:', {
      readyState: document.readyState,
      title: document.title,
      URL: document.URL,
      bodyTextLength: document.body.textContent?.length || 0,
      childElementCount: document.body.childElementCount
    });

    // Find all elements with text content
    const elementsWithText: Array<{element: string, text: string, length: number}> = [];
    const allElements = document.querySelectorAll('*');

    allElements.forEach((element) => {
      const text = element.textContent?.trim();
      if (text && text.length > 10) {
        elementsWithText.push({
          element: `${element.tagName}${element.id ? '#' + element.id : ''}${element.className ? '.' + element.className.replace(/\s+/g, '.') : ''}`,
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          length: text.length
        });
      }
    });

    console.log('Elements with significant text:', elementsWithText);

    // Check for specific PDF-related elements
    const pdfElements = {
      embed: document.querySelectorAll('embed'),
      object: document.querySelectorAll('object'),
      iframe: document.querySelectorAll('iframe'),
      textLayers: document.querySelectorAll('.textLayer, [class*="textLayer"]'),
      pageElements: document.querySelectorAll('[data-page-number], .page, [class*="page"]'),
      viewerElements: document.querySelectorAll('#viewer, #viewerContainer, [id*="viewer"]')
    };

    console.log('PDF-specific elements found:', {
      embeds: pdfElements.embed.length,
      objects: pdfElements.object.length,
      iframes: pdfElements.iframe.length,
      textLayers: pdfElements.textLayers.length,
      pageElements: pdfElements.pageElements.length,
      viewerElements: pdfElements.viewerElements.length
    });

    // Log details of found elements
    Object.entries(pdfElements).forEach(([type, elements]) => {
      if (elements.length > 0) {
        console.log(`${type} details:`, Array.from(elements).map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          textContent: el.textContent?.substring(0, 50)
        })));
      }
    });

    // Check for Shadow DOM
    this.checkShadowDOM();

    console.log('=== End DOM Analysis ===\n');
  }

  private checkShadowDOM(): void {
    const elementsWithShadow: Element[] = [];
    document.querySelectorAll('*').forEach(element => {
      if (element.shadowRoot) {
        elementsWithShadow.push(element);
      }
    });

    if (elementsWithShadow.length > 0) {
      console.log('Elements with Shadow DOM:', elementsWithShadow.map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        shadowRootMode: el.shadowRoot?.mode
      })));
    } else {
      console.log('No Shadow DOM elements found');
    }
  }

  private async initializePDFJS() {
    try {
      // Use statically imported PDF.js library
      this.pdfjsLib = pdfjsLib;

      // Set worker path
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
    } catch (error) {
      console.error('Failed to load PDF.js:', error);
    }
  }

  async extractPDFContent(): Promise<PDFContent> {
    const url = window.location.href;

    // For local files (file://), only use Chrome PDF viewer extraction
    if (url.startsWith('file://')) {
      console.log('Local file detected, using Chrome PDF viewer extraction only');
      return this.extractFromChromePDFViewer();
    }

    // Check if we're in Chrome's PDF viewer
    if (this.isChromePDFViewer()) {
      return this.extractFromChromePDFViewer();
    }

    // Try to extract using PDF.js (only for HTTP/HTTPS URLs)
    if (this.pdfjsLib && (url.startsWith('http://') || url.startsWith('https://'))) {
      return this.extractUsingPDFJS(url);
    }

    // Fallback: try to get any visible text
    return this.extractFallbackText();
  }

  private isChromePDFViewer(): boolean {
    // Check if we're in Chrome's built-in PDF viewer
    return document.querySelector('embed[type="application/pdf"]') !== null ||
           document.querySelector('#viewer') !== null ||
           window.location.href.includes('chrome-extension://') ||
           document.body.innerHTML.includes('pdf');
  }

  private async extractFromChromePDFViewer(): Promise<PDFContent> {
    const url = window.location.href;
    const title = this.extractTitleFromURL(url);

    console.log('\n🔍 === Chrome PDF Viewer Extraction Started ===');
    console.log('URL:', url);
    console.log('Title:', title);

    // Analyze DOM before extraction
    if (this.debugMode) {
      this.analyzeCurrentDOM();
    }

    // Wait for PDF to load
    console.log('⏳ Waiting for PDF to load...');
    await this.waitForPDFLoad();
    console.log('✅ PDF load wait completed');

    let textContent = '';
    let pageCount = 0;
    let successfulMethod = '';

    // Enhanced text extraction methods with detailed logging
    const extractionMethods = [
      { name: 'extractFromTextLayers', func: () => this.extractFromTextLayers() },
      { name: 'extractFromPDFPluginContent', func: () => this.extractFromPDFPluginContent() },
      { name: 'extractUsingClipboard', func: () => this.extractUsingClipboard() },
      { name: 'trySelectAllText', func: () => this.trySelectAllText() },
      { name: 'extractFromEmbedElement', func: () => this.extractFromEmbedElement() }
    ];

    for (const method of extractionMethods) {
      try {
        console.log(`🧪 Attempting: ${method.name}`);
        const result = method.func();
        console.log(`📊 Result from ${method.name}:`, {
          length: result?.length || 0,
          preview: result?.substring(0, 100) || 'No text'
        });

        if (result && result.length > 50) {
          textContent = result;
          successfulMethod = method.name;
          console.log(`✅ Success! Text extracted using: ${method.name}`);
          break;
        } else {
          console.log(`❌ ${method.name} - insufficient text (${result?.length || 0} chars)`);
        }
      } catch (error) {
        console.error(`💥 ${method.name} failed:`, error);
      }
    }

    // Count pages by looking for page indicators
    console.log('📄 Estimating page count...');
    pageCount = this.estimatePageCount();
    console.log('📄 Estimated page count:', pageCount);

    // Final analysis if no text found
    if (!textContent || textContent.length < 20) {
      console.log('⚠️ Text extraction failed, generating diagnostic report...');
      textContent = this.generateExtractionReport();

      // Additional DOM analysis after failed extraction
      if (this.debugMode) {
        this.analyzeCurrentDOM();
      }
    }

    const result = {
      title,
      url,
      textContent: textContent.substring(0, 10000),
      wordCount: this.countWords(textContent),
      pageCount: pageCount || 1
    };

    console.log('🏁 === Extraction Summary ===');
    console.log('Successful method:', successfulMethod || 'None');
    console.log('Final text length:', result.textContent.length);
    console.log('Word count:', result.wordCount);
    console.log('Page count:', result.pageCount);

    // Stop DOM monitoring and show summary
    if (this.debugMode) {
      this.stopDOMChangeDetection();
    }

    console.log('=== End Extraction ===\n');

    return result;
  }

  private async waitForPDFLoad(): Promise<void> {
    const startTime = Date.now();
    const maxWaitTime = 10000; // Increased to 10 seconds
    let attempts = 0;
    const maxAttempts = 100;

    console.log('⏱️ Starting PDF load detection...');

    while (attempts < maxAttempts && (Date.now() - startTime) < maxWaitTime) {
      const currentState = this.assessPDFLoadState();

      if (this.debugMode && attempts % 10 === 0) {
        console.log(`⏳ Attempt ${attempts + 1}/${maxAttempts}:`, currentState);
      }

      // More comprehensive load detection
      if (currentState.isLoaded) {
        console.log(`✅ PDF loaded after ${Date.now() - startTime}ms (${attempts + 1} attempts)`);
        console.log('Load indicators:', currentState);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if ((Date.now() - startTime) >= maxWaitTime) {
      console.log(`⏰ PDF load timeout after ${maxWaitTime}ms`);
    }

    // Final state assessment
    const finalState = this.assessPDFLoadState();
    console.log('📊 Final PDF load state:', finalState);
  }

  private assessPDFLoadState(): {isLoaded: boolean, indicators: any} {
    const indicators = {
      documentReady: document.readyState === 'complete',
      hasEmbed: !!document.querySelector('embed[type="application/pdf"]'),
      hasObject: !!document.querySelector('object[type="application/pdf"]'),
      hasTextLayers: document.querySelectorAll('.textLayer, [class*="textLayer"]').length > 0,
      hasPageElements: document.querySelectorAll('[data-page-number], .page, [class*="page"]').length > 0,
      hasViewerElements: document.querySelectorAll('#viewer, #viewerContainer, [id*="viewer"]').length > 0,
      bodyTextLength: document.body.textContent?.length || 0,
      totalElements: document.querySelectorAll('*').length,
      hasIframes: document.querySelectorAll('iframe').length > 0,
      windowLoaded: document.readyState !== 'loading'
    };

    // More intelligent load detection
    const isLoaded = indicators.documentReady && (
      indicators.hasEmbed ||
      indicators.hasObject ||
      indicators.hasTextLayers ||
      indicators.hasPageElements ||
      indicators.hasViewerElements ||
      indicators.bodyTextLength > 100 ||
      indicators.totalElements > 20
    );

    return { isLoaded, indicators };
  }

  private extractFromTextLayers(): string {
    console.log('🔍 Searching for text layers...');

    const textLayerSelectors = [
      '.textLayer',
      '.textLayer span',
      '[class*="textLayer"]',
      '[data-page-number] .textLayer',
      '#viewerContainer .textLayer'
    ];

    let text = '';
    const foundElements: any[] = [];

    for (const selector of textLayerSelectors) {
      const elements = document.querySelectorAll(selector);
      console.log(`  📍 Selector "${selector}": found ${elements.length} elements`);

      elements.forEach((element, elementIndex) => {
        const elementText = element.textContent?.trim();
        if (elementText && elementText.length > 5) {
          foundElements.push({
            selector,
            elementIndex,
            textLength: elementText.length,
            preview: elementText.substring(0, 50)
          });
          text += elementText + ' ';
        }
      });

      if (text.length > 100) {
        console.log(`  ✅ Sufficient text found with "${selector}"`);
        break;
      }
    }

    console.log(`📊 Text layer extraction results:`, {
      totalElements: foundElements.length,
      totalTextLength: text.length,
      elementsFound: foundElements
    });

    return text.trim();
  }

  private extractFromPDFPluginContent(): string {
    // Try to extract from various Chrome PDF plugin containers
    const containerSelectors = [
      'embed[type="application/pdf"]',
      '#plugin',
      '#viewer',
      '#viewerContainer',
      '[data-page-number]',
      '.page'
    ];

    let text = '';
    for (const selector of containerSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const elementText = element.textContent?.trim();
        if (elementText && elementText.length > 20) {
          text += elementText + '\n';
        }
      });
      if (text.length > 100) break;
    }

    return text;
  }

  private extractUsingClipboard(): string {
    try {
      // Simulate Ctrl+A to select all content
      document.execCommand('selectAll');

      // Get the selected text
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '';

      // Clear selection
      selection?.removeAllRanges();

      return selectedText;
    } catch (error) {
      console.warn('Clipboard extraction failed:', error);
      return '';
    }
  }

  private extractFromEmbedElement(): string {
    const embed = document.querySelector('embed[type="application/pdf"]');
    if (embed) {
      // Try to access content through the embed element
      try {
        const embedDoc = (embed as any).contentDocument || (embed as any).getSVGDocument();
        if (embedDoc) {
          return embedDoc.body?.textContent || embedDoc.textContent || '';
        }
      } catch (error) {
        console.warn('Embed element access failed:', error);
      }
    }
    return '';
  }

  private estimatePageCount(): number {
    // Look for page indicators in various formats
    const pageIndicators = [
      () => document.querySelectorAll('[data-page-number]').length,
      () => document.querySelectorAll('.page').length,
      () => document.querySelectorAll('.textLayer').length,
      () => {
        const pageText = document.body.textContent || '';
        const pageMatches = pageText.match(/Page \d+ of (\d+)/i);
        return pageMatches ? parseInt(pageMatches[1]) : 0;
      }
    ];

    for (const indicator of pageIndicators) {
      const count = indicator();
      if (count > 0) return count;
    }

    return 1;
  }

  private generateExtractionReport(): string {
    const embed = document.querySelector('embed[type="application/pdf"]');
    const textLayers = document.querySelectorAll('.textLayer');
    const pageElements = document.querySelectorAll('[data-page-number], .page');

    return `PDF Document Analysis:
- Embed element found: ${embed ? 'Yes' : 'No'}
- Text layers detected: ${textLayers.length}
- Page elements found: ${pageElements.length}
- Document ready state: ${document.readyState}
- Body text length: ${document.body.textContent?.length || 0}

This PDF might be:
1. A scanned document without text layer
2. Still loading in Chrome's PDF viewer
3. Protected or encrypted content

Try refreshing the page or opening a different PDF file.`;
  }

  private async extractUsingPDFJS(url: string): Promise<PDFContent> {
    try {
      const title = this.extractTitleFromURL(url);

      // Load PDF document
      const pdf = await this.pdfjsLib.getDocument(url).promise;
      const pageCount = pdf.numPages;

      let fullText = '';

      // Extract text from each page (limit to first 10 pages for performance)
      const maxPages = Math.min(pageCount, 10);

      for (let i = 1; i <= maxPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');

          fullText += pageText + '\n\n';
        } catch (pageError) {
          console.error(`Error extracting page ${i}:`, pageError);
        }
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

    // Try to get any text content from the page
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

  private trySelectAllText(): string {
    try {
      // Try to select all content and get selected text
      document.execCommand('selectAll');
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '';

      // Clear selection
      selection?.removeAllRanges();

      return selectedText;
    } catch (error) {
      console.error('Select all text failed:', error);
      return '';
    }
  }

  private extractTitleFromURL(url: string): string {
    try {
      const urlPath = new URL(url).pathname;
      const fileName = urlPath.split('/').pop() || '';

      // Remove .pdf extension and decode URI
      const title = decodeURIComponent(fileName.replace('.pdf', ''));

      return title || 'PDF Document';
    } catch (error) {
      return 'PDF Document';
    }
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
}

// Initialize PDF extractor
const pdfExtractor = new PDFTextExtractor();

// Listen for messages from sidepanel
chrome.runtime.onMessage.addListener((
  request: { action: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean; data?: PDFContent; error?: string }) => void
): boolean => {
  if (request.action === 'extractContent') {
    pdfExtractor.extractPDFContent()
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

// Function to safely send message to background script
function safelySendMessage(message: any): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (_response) => {
        if (chrome.runtime.lastError) {
          console.warn('Runtime message error:', chrome.runtime.lastError.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    } catch (error) {
      console.warn('Failed to send message:', error);
      resolve(false);
    }
  });
}

// Auto-extract when PDF loads with retry mechanism
function attemptAutoExtraction(retryCount = 0) {
  const maxRetries = 3;
  const delay = Math.min(2000 * Math.pow(2, retryCount), 10000); // Exponential backoff

  setTimeout(async () => {
    try {
      console.log(`PDF extraction attempt ${retryCount + 1}/${maxRetries + 1}`);

      const content = await pdfExtractor.extractPDFContent();
      const success = await safelySendMessage({
        action: 'contentReady',
        data: content
      });

      if (!success && retryCount < maxRetries) {
        console.log(`Message failed, retrying in ${delay * 2}ms...`);
        attemptAutoExtraction(retryCount + 1);
      } else if (!success) {
        console.error('Failed to communicate with background script after all retries');
      }
    } catch (error) {
      console.error('Auto-extraction failed:', error);

      if (retryCount < maxRetries) {
        attemptAutoExtraction(retryCount + 1);
      } else {
        // Send error message as final attempt
        await safelySendMessage({
          action: 'contentReady',
          data: {
            title: 'PDF Document',
            url: window.location.href,
            textContent: 'Failed to extract PDF content automatically.',
            wordCount: 0,
            pageCount: 0
          }
        });
      }
    }
  }, delay);
}

// Wait for page to be fully loaded before starting extraction
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => attemptAutoExtraction());
} else {
  attemptAutoExtraction();
}