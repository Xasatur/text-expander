// Load existing snippets when popup opens
document.addEventListener('DOMContentLoaded', loadSnippets);

function normalizeSnippetData(data) {
    if (typeof data === 'string') {
        return {
            variants: {
                internal: data,
                external: data
            },
            category: 'Default',
            defaultAudience: 'internal'
        };
    }

    if (!data) {
        return {
            variants: {
                internal: '',
                external: ''
            },
            category: 'Default',
            defaultAudience: 'internal'
        };
    }

    if (data.variants) {
        return {
            variants: {
                internal: data.variants.internal || data.variants.external || '',
                external: data.variants.external || data.variants.internal || ''
            },
            category: data.category || 'Default',
            defaultAudience: data.defaultAudience || 'internal'
        };
    }

    const phrase = data.phrase || '';
    return {
        variants: {
            internal: phrase,
            external: phrase
        },
        category: data.category || 'Default',
        defaultAudience: data.defaultAudience || 'internal'
    };
}

function loadSnippets() {
    chrome.storage.sync.get(['snippets'], function(result) {
        const snippets = result.snippets || {};
        const container = document.getElementById('snippetList');
        container.innerHTML = '';
        
        Object.entries(snippets).forEach(([trigger, data]) => {
            const normalized = normalizeSnippetData(data);
            addSnippetToUI(
                trigger,
                normalized.variants.internal,
                normalized.variants.external,
                normalized.defaultAudience
            );
        });
    });
}

function addSnippetToUI(trigger = '', internalPhrase = '', externalPhrase = '', defaultAudience = 'internal') {
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
    
    const internalLabel = document.createElement('label');
    internalLabel.textContent = 'Intern (du)';
    internalLabel.style.fontSize = '12px';
    internalLabel.style.display = 'block';
    internalLabel.style.marginTop = '6px';
    
    const internalInput = document.createElement('textarea');
    internalInput.className = 'phrase-internal';
    internalInput.value = internalPhrase;
    internalInput.placeholder = 'Text für Mitarbeitende';
    internalInput.rows = 2;
    internalInput.style.width = '100%';
    internalInput.style.resize = 'vertical';
    
    const externalLabel = document.createElement('label');
    externalLabel.textContent = 'Extern (Sie)';
    externalLabel.style.fontSize = '12px';
    externalLabel.style.display = 'block';
    externalLabel.style.marginTop = '6px';
    
    const externalInput = document.createElement('textarea');
    externalInput.className = 'phrase-external';
    externalInput.value = externalPhrase;
    externalInput.placeholder = 'Text für Kund:innen';
    externalInput.rows = 2;
    externalInput.style.width = '100%';
    externalInput.style.resize = 'vertical';
    
    const audienceSelect = document.createElement('select');
    audienceSelect.className = 'audience-select';
    audienceSelect.innerHTML = `
        <option value="internal">Standard: Intern (du)</option>
        <option value="external">Standard: Extern (Sie)</option>
    `;
    audienceSelect.value = defaultAudience === 'external' ? 'external' : 'internal';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    
    contentDiv.appendChild(triggerInput);
    contentDiv.appendChild(internalLabel);
    contentDiv.appendChild(internalInput);
    contentDiv.appendChild(externalLabel);
    contentDiv.appendChild(externalInput);
    contentDiv.appendChild(audienceSelect);
    snippetDiv.appendChild(contentDiv);
    snippetDiv.appendChild(deleteBtn);
    container.appendChild(snippetDiv);
    
    // Save when inputs change
    [triggerInput, internalInput, externalInput, audienceSelect].forEach(input => {
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
        const internalPhrase = item.querySelector('.phrase-internal').value.trim();
        const externalPhrase = item.querySelector('.phrase-external').value.trim();
        const defaultAudience = item.querySelector('.audience-select').value;
        if (trigger && (internalPhrase || externalPhrase)) {
            snippets[trigger] = {
                variants: {
                    internal: internalPhrase || externalPhrase,
                    external: externalPhrase || internalPhrase
                },
                defaultAudience: defaultAudience,
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
