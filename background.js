// Keep track of the tab that opened the variables popup
let sourceTabId = null;
// Track audience selection popups
const audienceContexts = new Map();

// Remove existing context menus and create new ones
chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
        id: "debugField",
        title: "Debug Text Field",
        contexts: ["editable"]
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "debugField") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'debugField'
        }, {frameId: info.frameId});
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message, 'from:', sender);

    if (message.action === 'openVariablesPopup') {
        // Store the source tab ID
        sourceTabId = sender.tab.id;

        // Create URL with parameters
        const url = 'variables.html?' + new URLSearchParams({
            text: message.text,
            elementId: message.elementId
        }).toString();
        
        // Open popup window
        chrome.windows.create({
            url: url,
            type: 'popup',
            width: 560,
            height: 420
        });

        sendResponse({success: true});
        return true; // Keep the message channel open
    }

    else if (message.action === 'openAudiencePopup') {
        if (!sender.tab) {
            sendResponse({success: false, error: 'No sender tab'});
            return false;
        }

        const elementId = message.elementId;
        const context = {
            tabId: sender.tab.id,
            frameId: sender.frameId,
            variants: message.variants || {},
            defaultAudience: message.defaultAudience || 'internal',
            elementId: elementId,
            windowId: null
        };

        audienceContexts.set(elementId, context);

        const url = 'audience.html?' + new URLSearchParams({
            elementId: elementId
        }).toString();

        chrome.windows.create({
            url: url,
            type: 'popup',
            width: 640,
            height: 520
        }, createdWindow => {
            if (createdWindow?.id !== undefined) {
                context.windowId = createdWindow.id;
            }
        });

        sendResponse({success: true});
        return true;
    }

    else if (message.action === 'fillVariablesFromPopup') {
        // Forward the message to the original content script
        if (sourceTabId) {
            chrome.tabs.sendMessage(sourceTabId, {
                action: 'fillVariables',
                text: message.data.text,
                elementId: message.data.elementId
            }, response => {
                console.log('Response from content script:', response);
                sendResponse(response);
            });
            return true; // Keep the message channel open
        }
    }

    else if (message.action === 'getAudienceData') {
        const context = audienceContexts.get(message.elementId);
        if (!context) {
            sendResponse({success: false, error: 'No audience context found'});
            return false;
        }
        sendResponse({
            success: true,
            data: {
                variants: context.variants,
                defaultAudience: context.defaultAudience,
                elementId: context.elementId
            }
        });
        return true;
    }

    else if (message.action === 'audienceSelection') {
        const context = audienceContexts.get(message.data?.elementId);
        if (!context) {
            sendResponse({success: false, error: 'No audience context found'});
            return false;
        }

        const variantKey = message.data.variant;
        let text = context.variants?.[variantKey];
        if (!text) {
            const fallbackKey = variantKey === 'internal' ? 'external' : 'internal';
            text = context.variants?.[fallbackKey] || '';
        }

        audienceContexts.delete(context.elementId);

        chrome.tabs.sendMessage(context.tabId, {
            action: 'audienceSelected',
            elementId: context.elementId,
            variant: variantKey,
            text: text
        }, {frameId: context.frameId}, response => {
            console.log('Audience selection forwarded:', response);
        });

        if (context.windowId !== null) {
            chrome.windows.remove(context.windowId, () => {});
        }
        sendResponse({success: true});
        return true;
    }

    else if (message.action === 'audienceCancelled') {
        const context = audienceContexts.get(message.elementId);
        if (context) {
            chrome.tabs.sendMessage(context.tabId, {
                action: 'audienceCancelled',
                elementId: context.elementId
            }, {frameId: context.frameId});
            audienceContexts.delete(context.elementId);
        }
        sendResponse({success: true});
        return false;
    }

    else if (message.action === 'debugInfo') {
        // Log debug info to background console
        console.log('Field Debug Info:', message.info);
        // Show debug info in an alert in the target tab
        chrome.tabs.sendMessage(sender.tab.id, {
            action: 'showDebugAlert',
            info: message.info
        }, {frameId: sender.frameId});
        return true; // Keep the message channel open
    }
});

chrome.windows.onRemoved.addListener((windowId) => {
    for (const [elementId, context] of audienceContexts.entries()) {
        if (context.windowId === windowId) {
            chrome.tabs.sendMessage(context.tabId, {
                action: 'audienceCancelled',
                elementId: elementId
            }, {frameId: context.frameId});
            audienceContexts.delete(elementId);
        }
    }
});
