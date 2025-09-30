// Sidepanel script to display PDF content

interface PDFContent {
  title: string;
  url: string;
  textContent: string;
  wordCount: number;
  pageCount: number;
  fileSize?: string;
}

interface Elements {
  status: HTMLElement;
  pageInfo: HTMLElement;
  pageUrl: HTMLElement;
  pageTitle: HTMLElement;
  pageCount: HTMLElement;
  wordCount: HTMLElement;
  contentSection: HTMLElement;
  contentDisplay: HTMLElement;
  loading: HTMLElement;
  error: HTMLElement;
  errorMessage: HTMLElement;
  refreshBtn: HTMLButtonElement;
  retryBtn: HTMLButtonElement;
  copyBtn: HTMLButtonElement;
  summarizeBtn: HTMLButtonElement;
}

class SidepanelController {
  private elements: Elements;

  constructor() {
    this.elements = this.initializeElements();
    this.bindEvents();
    this.loadContent();
  }

  private initializeElements(): Elements {
    return {
      status: document.getElementById('status')!,
      pageInfo: document.getElementById('pageInfo')!,
      pageUrl: document.getElementById('pageUrl')!,
      pageTitle: document.getElementById('pageTitle')!,
      pageCount: document.getElementById('pageCount')!,
      wordCount: document.getElementById('wordCount')!,
      contentSection: document.getElementById('contentSection')!,
      contentDisplay: document.getElementById('contentDisplay')!,
      loading: document.getElementById('loading')!,
      error: document.getElementById('error')!,
      errorMessage: document.getElementById('errorMessage')!,
      refreshBtn: document.getElementById('refreshBtn') as HTMLButtonElement,
      retryBtn: document.getElementById('retryBtn') as HTMLButtonElement,
      copyBtn: document.getElementById('copyBtn') as HTMLButtonElement,
      summarizeBtn: document.getElementById('summarizeBtn') as HTMLButtonElement,
    };
  }

  private bindEvents(): void {
    this.elements.refreshBtn.addEventListener('click', () => this.refreshContent());
    this.elements.retryBtn.addEventListener('click', () => this.refreshContent());
    this.elements.copyBtn.addEventListener('click', () => this.copyContent());
    this.elements.summarizeBtn.addEventListener('click', () => this.summarizeContent());

    // Listen for storage changes (background script updates)
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.pageContent) {
        this.displayContent(changes.pageContent.newValue);
      }
    });
  }

  private async loadContent(): Promise<void> {
    this.showLoading();

    try {
      // First try to get existing content from background
      const response = await this.sendMessage({ action: 'getPageContent' });

      if (response.success && response.data) {
        this.displayContent(response.data);
      } else {
        // Request fresh content extraction
        await this.refreshContent();
      }
    } catch (error) {
      console.error('Error loading content:', error);
      this.showError('Failed to load page content');
    }
  }

  private async refreshContent(): Promise<void> {
    this.showLoading();

    try {
      const response = await this.sendMessage({ action: 'requestContent' });

      if (response.success && response.data) {
        this.displayContent(response.data);
      } else {
        this.showError(response.error || 'Failed to extract page content');
      }
    } catch (error) {
      console.error('Error refreshing content:', error);
      this.showError('Failed to refresh page content');
    }
  }

  private displayContent(content: PDFContent): void {

    // Hide loading and error states
    this.hideLoading();
    this.hideError();

    // Update page info
    this.elements.pageTitle.textContent = content.title;
    this.elements.pageUrl.textContent = content.url;
    this.elements.pageCount.textContent = content.pageCount.toString();
    this.elements.wordCount.textContent = content.wordCount.toString();
    this.elements.pageInfo.style.display = 'block';

    // Update content display
    this.elements.contentDisplay.textContent = content.textContent;
    this.elements.contentSection.style.display = 'block';

    // Update status
    this.elements.status.innerHTML = `
      ✅ Content loaded successfully<br>
      <small>${content.wordCount} words • ${content.pageCount} pages</small>
    `;
  }

  private showLoading(): void {
    this.elements.loading.style.display = 'block';
    this.elements.pageInfo.style.display = 'none';
    this.elements.contentSection.style.display = 'none';
    this.elements.error.style.display = 'none';
    this.elements.refreshBtn.disabled = true;

    this.elements.status.textContent = 'Loading...';
  }

  private hideLoading(): void {
    this.elements.loading.style.display = 'none';
    this.elements.refreshBtn.disabled = false;
  }

  private showError(message: string): void {
    this.hideLoading();
    this.elements.error.style.display = 'block';
    this.elements.errorMessage.textContent = message;
    this.elements.pageInfo.style.display = 'none';
    this.elements.contentSection.style.display = 'none';

    this.elements.status.innerHTML = `❌ Error occurred`;
  }

  private hideError(): void {
    this.elements.error.style.display = 'none';
  }

  private async copyContent(): Promise<void> {
    try {
      const textContent = this.elements.contentDisplay.textContent || '';
      await navigator.clipboard.writeText(textContent);

      // Show temporary feedback
      const originalText = this.elements.copyBtn.textContent;
      this.elements.copyBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        this.elements.copyBtn.textContent = originalText;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy content:', error);
      this.elements.copyBtn.textContent = '❌ Failed';
      setTimeout(() => {
        this.elements.copyBtn.textContent = '📋 Copy Text';
      }, 2000);
    }
  }

  private summarizeContent(): Promise<void> {
    // Placeholder for future AI summarization feature
    this.elements.summarizeBtn.textContent = '🚧 Coming Soon';
    setTimeout(() => {
      this.elements.summarizeBtn.textContent = '✨ Summarize';
    }, 2000);
    return Promise.resolve();
  }

  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }
}

// Initialize sidepanel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SidepanelController();
});