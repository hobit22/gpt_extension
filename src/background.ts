// Background script for PDF text extraction

interface PDFContent {
  title: string;
  url: string;
  textContent: string;
  wordCount: number;
  pageCount: number;
  fileSize?: string;
}

// Store current PDF content
let currentPDFContent: PDFContent | null = null;

// Initialize listeners
chrome.runtime.onInstalled.addListener(() => {
  console.log('PDF Text Extractor extension installed');
});

// Handle action button click to open sidepanel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    // Open sidepanel (API might vary based on Chrome version)
    try {
      await (chrome as any).sidePanel.open({ tabId: tab.id });
    } catch (error) {
      console.log('SidePanel API not available or different syntax');
    }
  }
});

// Handle messages from content script and sidepanel
chrome.runtime.onMessage.addListener((
  message: { action: string; data?: PDFContent },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): boolean => {

  switch (message.action) {
    case 'contentReady':
      // Content script automatically extracted PDF content
      if (message.data) {
        currentPDFContent = message.data;
        console.log('PDF content received:', message.data.title, `${message.data.wordCount} words`);

        // Notify sidepanel if it's open
        notifySidepanel('contentUpdate', message.data);
      }
      sendResponse({ success: true });
      break;

    case 'getPageContent':
      // Sidepanel requesting current PDF content
      if (currentPDFContent) {
        sendResponse({ success: true, data: currentPDFContent });
      } else {
        // Try to extract content from active tab
        extractContentFromActiveTab(sendResponse);
        return true; // Keep channel open for async response
      }
      break;

    case 'requestContent':
      // Sidepanel requesting fresh PDF content extraction
      extractContentFromActiveTab(sendResponse);
      return true; // Keep channel open for async response

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }

  return false;
});

// Function to extract content from active tab
async function extractContentFromActiveTab(sendResponse: (response: any) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, { action: 'extractContent' }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: `Content script error: ${chrome.runtime.lastError.message}`
        });
        return;
      }

      if (response && response.success && response.data) {
        currentPDFContent = response.data;
        sendResponse({ success: true, data: response.data });
      } else {
        sendResponse({
          success: false,
          error: response?.error || 'Failed to extract content'
        });
      }
    });

  } catch (error) {
    sendResponse({
      success: false,
      error: `Background script error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

// Function to notify sidepanel of updates
function notifySidepanel(_action: string, data: any) {
  // Note: Direct communication to sidepanel is limited
  // Sidepanel will need to poll for updates or we'll use storage
  chrome.storage.local.set({
    lastUpdate: Date.now(),
    pageContent: data
  });
}

// Handle tab updates to clear old content
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, _tab) => {
  if (changeInfo.status === 'loading') {
    // Clear old PDF content when navigation starts
    currentPDFContent = null;
  }
});

// Handle tab activation to get content from new active tab
chrome.tabs.onActivated.addListener(async (_activeInfo) => {
  // Clear old PDF content when switching tabs
  currentPDFContent = null;
});