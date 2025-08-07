// Initialize snippets from storage
let SNIPPETS = {};

// ServiceNow field selectors
const SERVICE_NOW_SELECTORS = [
    'input.form-control',
    'textarea.form-control',
    'input[id^="sys_display"]',
    'input[name^="sys_display"]',
    '[data-type="string"]',
    '[data-type="journal"]',
    '[data-type="journal_input"]',
    '.sn-field-reference',
    '.sn-field-text',
    '.sn-field-textarea',
    // Add specific field selectors
    'input[name="short_description"]',
    'textarea[name="description"]',
    'input[name="comments"]',
    'textarea[name="comments"]',
    // General ServiceNow patterns
    '[aria-label*="field"]',
    '[id*="field"]',
    '[data-field-type]'
].join(',');

// TinyMCE editor cache
let tinyMCEEditors = new WeakMap();

// Load snippets from storage
function loadSnippets() {
    try {
        chrome.storage.sync.get(['snippets'], function(result) {
            if (chrome.runtime.lastError) {
                console.error('Storage error:', chrome.runtime.lastError);
                return;
            }
            SNIPPETS = Object.entries(result.snippets || {}).reduce((acc, [trigger, data]) => {
                acc[trigger] = typeof data === 'string' ? data : data.phrase;
                return acc;
            }, {});
            console.log('Snippets loaded:', Object.keys(SNIPPETS).length);
        });
    } catch (e) {
        console.error('Error loading snippets:', e);
    }
}

// Listen for changes in storage
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.snippets) {
        SNIPPETS = Object.entries(changes.snippets.newValue || {}).reduce((acc, [trigger, data]) => {
            acc[trigger] = typeof data === 'string' ? data : data.phrase;
            return acc;
        }, {});
        console.log('Updated snippets:', Object.keys(SNIPPETS).length);
    }
});

// Listen for messages from the variables popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fillVariables') {
        const element = document.querySelector(`[data-expander-id="${message.elementId}"]`);
        if (element) {
            replaceTextInElement(element, message.text);
            // Remove the expander id after use
            element.removeAttribute('data-expander-id');
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Element not found' });
        }
        return true;
    }
});

function getTinyMCEEditor(el) {
    try {
        // First check our cache
        if (tinyMCEEditors.has(el)) {
            return tinyMCEEditors.get(el);
        }

        // ServiceNow specific: Check for TinyMCE in iframe
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                const iframeWindow = iframe.contentWindow;
                const iframeDoc = iframe.contentDocument || iframeWindow.document;
                
                if (iframeWindow && iframeWindow.tinymce) {
                    const editors = iframeWindow.tinymce.editors || [];
                    for (const editor of editors) {
                        if (editor.getElement() === el) {
                            tinyMCEEditors.set(el, editor);
                            return editor;
                        }
                    }
                }
            } catch (e) {
                console.log('Error accessing iframe:', e);
            }
        }

        // Try to find TinyMCE instance in main window
        if (window.tinymce && window.tinymce.editors) {
            const editor = window.tinymce.editors.find(ed => {
                try {
                    return ed.getElement() === el;
                } catch (e) {
                    return false;
                }
            });
            if (editor) {
                tinyMCEEditors.set(el, editor);
                return editor;
            }
        }
    } catch (e) {
        console.log('Error in getTinyMCEEditor:', e);
    }
    return null;
}

function isServiceNowField(el) {
    if (!el || !el.nodeType || el.nodeType !== 1) return false;

    // Check if element matches our selectors
    if (el.matches && el.matches(SERVICE_NOW_SELECTORS)) {
        return !el.readOnly && !el.disabled;
    }

    // Check for contenteditable fields
    if (el.isContentEditable) {
        return true;
    }

    return false;
}

function setupServiceNowField(field) {
    if (!field || field.dataset.expanderInitialized) return;

    console.log('Setting up ServiceNow field:', field.tagName, field.className, field);

    // Use the unified listener setup which handles variables
    setupListener(field);

    // Mark as initialized
    field.dataset.expanderInitialized = 'true';
}

function getElementValue(el) {
    try {
        // For standard inputs and textareas
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            return el.value || '';
        }

        // For contenteditable elements
        if (el.isContentEditable) {
            return el.innerText || el.textContent || '';
        }

        // Default fallback
        return el.value || el.innerText || el.textContent || '';
    } catch (e) {
        console.log('Error in getElementValue:', e);
        return '';
    }
}

function setElementValue(el, value) {
    try {
        // For standard form elements
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.value = value;
            
            // Dispatch events
            const events = [
                new Event('input', { bubbles: true }),
                new Event('change', { bubbles: true }),
                new Event('blur', { bubbles: true }),
                // ServiceNow specific events
                new CustomEvent('sn.form.value.change', { bubbles: true }),
                new CustomEvent('sn.field.change', { bubbles: true })
            ];

            events.forEach(event => el.dispatchEvent(event));
            return;
        }

        // For contenteditable elements
        if (el.isContentEditable) {
            el.innerText = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
    } catch (e) {
        console.log('Error in setElementValue:', e);
    }
}

function isEditableElement(element) {
    if (!element || !element.nodeType || element.nodeType !== 1) return false;

    // Check for TinyMCE editor
    if (getTinyMCEEditor(element)) {
        return true;
    }

    // Skip elements that are hidden or disabled
    if (!element.offsetParent || element.disabled || element.readOnly || 
        element.style.display === 'none' || element.style.visibility === 'hidden') {
        return false;
    }

    // Check for Chakra UI components
    if (element.classList?.contains('chakra-textarea') || 
        element.classList?.contains('chakra-input')) {
        return true;
    }

    // Check for standard input types
    if (element.tagName === 'INPUT' && (
        element.type === 'text' ||
        element.type === 'email' ||
        element.type === 'search' ||
        element.type === 'tel' ||
        element.type === 'url'
    )) {
        return true;
    }

    // Check for textarea
    if (element.tagName === 'TEXTAREA') {
        return true;
    }

    // Check for contenteditable
    if (element.isContentEditable || element.contentEditable === 'true') {
        return true;
    }

    // Check for ServiceNow specific elements
    if (element.classList && (
        element.classList.contains('now-textarea-field') ||
        element.classList.contains('now-form-field') ||
        element.classList.contains('form-control') ||
        element.classList.contains('sn-textarea-rich-text-editor')
    )) {
        return true;
    }

    // Check for iframe editor
    if (element.tagName === 'IFRAME' || element.querySelector('iframe')) {
        return true;
    }

    return false;
}

function setupListener(input) {
    if (!input || input.dataset.listenerAttached) return;

    const handler = (event) => {
        console.log('Input event on:', input.tagName, input.className);
        replaceTrigger(input);
    };

    // For TinyMCE editors
    const tinyEditor = getTinyMCEEditor(input);
    if (tinyEditor) {
        tinyEditor.on('input keyup paste', handler);
        input.dataset.listenerAttached = 'true';
        return;
    }

    // Add listeners to both the element and any nested input elements
    const elements = [input];
    const nestedInput = input.querySelector('input, textarea');
    if (nestedInput) {
        elements.push(nestedInput);
    }

    elements.forEach(el => {
        try {
            ['input', 'keyup', 'paste'].forEach(eventType => {
                el.addEventListener(eventType, handler);
            });
        } catch (e) {
            console.log('Error attaching listener:', e);
        }
    });

    input.dataset.listenerAttached = 'true';
}

function replaceTextInElement(el, newText) {
    const oldValue = getElementValue(el);
    let cursorPos = 0;
    let beforeCursor = '';
    let afterCursor = '';
    let trigger = null;

    // For input/textarea
    if (el.selectionStart !== undefined) {
        cursorPos = el.selectionStart;
        beforeCursor = oldValue.substring(0, cursorPos);
        afterCursor = oldValue.substring(cursorPos);
        trigger = Object.keys(SNIPPETS).find(t => beforeCursor.endsWith(t));
        if (trigger) {
            const finalText = beforeCursor.slice(0, -trigger.length) + newText + afterCursor;
            setElementValue(el, finalText);
            // Restore cursor position after inserted text
            const newCursorPos = beforeCursor.length - trigger.length + newText.length;
            el.setSelectionRange(newCursorPos, newCursorPos);
        }
        return;
    }

    // For contenteditable
    if (el.isContentEditable) {
        // Convert newlines to <br>
        const htmlText = newText.replace(/\n/g, '<br>');
        // Get current selection
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        // Find trigger in text before cursor
        const preRange = range.cloneRange();
        preRange.collapse(true);
        preRange.setStart(el, 0);
        const before = preRange.toString();
        trigger = Object.keys(SNIPPETS).find(t => before.endsWith(t));
        if (trigger) {
            // Replace trigger with newText (as HTML)
            // Move range to cover the trigger
            preRange.setStart(preRange.endContainer, preRange.endOffset - trigger.length);
            preRange.deleteContents();
            // Insert HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlText;
            const frag = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                frag.appendChild(tempDiv.firstChild);
            }
            preRange.insertNode(frag);
            // Move cursor after inserted content
            if (frag.lastChild) {
                range.setStartAfter(frag.lastChild);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            // Update element value
            setElementValue(el, el.innerText);
        }
        return;
    }

    // Fallback: just replace all triggers in value
    trigger = Object.keys(SNIPPETS).find(t => oldValue.endsWith(t));
    if (trigger) {
        const finalText = oldValue.slice(0, -trigger.length) + newText;
        setElementValue(el, finalText);
    }
}

function replaceTrigger(el) {
    const text = getElementValue(el);
    const cursorPos = el.selectionStart !== undefined ? el.selectionStart : (window.getSelection && el.isContentEditable ? window.getSelection().focusOffset : text.length);
    const beforeCursor = text.substring(0, cursorPos);

    for (let trigger of Object.keys(SNIPPETS)) {
        if (beforeCursor.endsWith(trigger)) {
            console.log('Found trigger:', trigger);
            const replacement = SNIPPETS[trigger];

            if (hasVariables(replacement)) {
                console.log('[Expander] Detected variables, opening popup for:', replacement);
                // Set a unique data-expander-id on the element
                const elementId = 'expander_' + Math.random().toString(36).substr(2, 9);
                el.dataset.expanderId = elementId;

                chrome.runtime.sendMessage({
                    action: 'openVariablesPopup',
                    text: replacement,
                    elementId: elementId
                });
                return;
            }

            replaceTextInElement(el, replacement);
            break;
        }
    }
}

function hasVariables(text) {
    // Support both legacy {{var}} syntax and new (var) syntax
    return /(\{\{[^}]+\}\}|\([^()]+\))/.test(text);
}

// Initialize
loadSnippets();

// Watch for DOM changes
const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        // Check added nodes
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
                // Check if the node itself is a ServiceNow field or contenteditable
                if (isServiceNowField(node) || node.isContentEditable) {
                    setupServiceNowField(node);
                }
                // Check children for ServiceNow fields or contenteditable
                node.querySelectorAll(SERVICE_NOW_SELECTORS + ', [contenteditable="true"]').forEach(field => {
                    if (isServiceNowField(field) || field.isContentEditable) {
                        setupServiceNowField(field);
                    }
                });
            }
        });
        // Check for attribute changes that might make a field editable
        if (mutation.type === 'attributes') {
            const el = mutation.target;
            if (el.nodeType === 1 && (isServiceNowField(el) || el.isContentEditable)) {
                setupServiceNowField(el);
            }
        }
    });
});

// Start observing with appropriate options
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['contenteditable', 'disabled', 'readonly']
});

// Initial setup for existing fields
document.querySelectorAll(SERVICE_NOW_SELECTORS + ', [contenteditable="true"]').forEach(field => {
    if (isServiceNowField(field) || field.isContentEditable) {
        setupServiceNowField(field);
    }
});

// Add debug logging
console.log('Text expander initialized for ServiceNow');
console.log('Watching for fields matching:', SERVICE_NOW_SELECTORS);
  