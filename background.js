// Keep track of the tab that opened the variables popup
let sourceTabId = null;

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
            width: 400,
            height: 300
        });
        
        sendResponse({success: true});
        return true; // Keep the message channel open
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