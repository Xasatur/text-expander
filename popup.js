// Load existing snippets when popup opens
document.addEventListener('DOMContentLoaded', loadSnippets);

function loadSnippets() {
    chrome.storage.sync.get(['snippets'], function(result) {
        const snippets = result.snippets || {};
        const container = document.getElementById('snippetList');
        container.innerHTML = '';
        
        Object.entries(snippets).forEach(([trigger, data]) => {
            const phrase = typeof data === 'string' ? data : data.phrase;
            addSnippetToUI(trigger, phrase);
        });
    });
}

function addSnippetToUI(trigger = '', phrase = '') {
    const container = document.getElementById('snippetList');
    const snippetDiv = document.createElement('div');
    snippetDiv.className = 'snippet-item';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'snippet-content';
    
    const triggerInput = document.createElement('input');
    triggerInput.type = 'text';
    triggerInput.className = 'trigger';
    triggerInput.value = trigger;
    triggerInput.placeholder = 'Trigger (e.g., -danke)';
    
    // Use textarea for multi-line support
    const phraseInput = document.createElement('textarea');
    phraseInput.className = 'phrase';
    phraseInput.value = phrase;
    phraseInput.placeholder = 'Expanded Text';
    phraseInput.rows = 3;
    phraseInput.style.width = '100%';
    phraseInput.style.resize = 'vertical';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    
    contentDiv.appendChild(triggerInput);
    contentDiv.appendChild(phraseInput);
    snippetDiv.appendChild(contentDiv);
    snippetDiv.appendChild(deleteBtn);
    container.appendChild(snippetDiv);
    
    // Save when inputs change
    [triggerInput, phraseInput].forEach(input => {
        input.addEventListener('change', saveSnippets);
        input.addEventListener('input', saveSnippets);
    });
    
    // Delete snippet
    deleteBtn.addEventListener('click', () => {
        snippetDiv.remove();
        saveSnippets();
    });
}

function saveSnippets() {
    const snippets = {};
    document.querySelectorAll('.snippet-item').forEach(item => {
        const trigger = item.querySelector('.trigger').value.trim();
        const phrase = item.querySelector('.phrase').value.trim();
        if (trigger && phrase) {
            snippets[trigger] = {
                phrase: phrase,
                category: 'Default'
            };
        }
    });
    
    chrome.storage.sync.set({ snippets }, function() {
        const status = document.getElementById('status');
        status.textContent = 'Snippets saved!';
        setTimeout(() => status.textContent = '', 2000);
    });
}

// Add new snippet button
document.getElementById('addNew').addEventListener('click', () => {
    addSnippetToUI();
});

// Open manager button
document.getElementById('openManager').addEventListener('click', () => {
    chrome.windows.create({
        url: 'manage.html',
        type: 'popup',
        width: 1200,
        height: 800
    });
}); 