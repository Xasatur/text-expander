let snippets = {};
let categories = ['Default'];
let currentCategory = 'Default';
let currentStorageMode = 'sync';
let localFallbackNotified = false;

function getPreferredStorage(callback) {
    chrome.storage.local.get(['storageMode'], data => {
        const mode = data.storageMode === 'local' ? 'local' : 'sync';
        callback(mode);
    });
}

function isEmptyResult(result, keys) {
    return !keys.some(key => Object.prototype.hasOwnProperty.call(result, key) && result[key] !== undefined);
}

function isQuotaError(error) {
    return error && error.message && error.message.toLowerCase().includes('quota');
}

function loadFromStorage(keys, callback) {
    getPreferredStorage(mode => {
        const primary = mode === 'local' ? chrome.storage.local : chrome.storage.sync;
        primary.get(keys, result => {
            if (chrome.runtime.lastError || isEmptyResult(result, keys)) {
                if (mode === 'sync') {
                    chrome.storage.local.get(keys, localResult => {
                        if (!isEmptyResult(localResult, keys)) {
                            currentStorageMode = 'local';
                            callback('local', localResult);
                        } else {
                            currentStorageMode = mode;
                            callback(mode, result);
                        }
                    });
                    return;
                }
            }
            currentStorageMode = mode;
            callback(mode, result);
        });
    });
}

function saveToStorage(data, onSuccess, onError) {
    if (currentStorageMode === 'local') {
        chrome.storage.local.set({ ...data, storageMode: 'local' }, () => {
            if (chrome.runtime.lastError) {
                onError?.(chrome.runtime.lastError);
            } else {
                onSuccess?.('local');
            }
        });
        return;
    }

    chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
            if (isQuotaError(chrome.runtime.lastError)) {
                chrome.storage.local.set({ ...data, storageMode: 'local' }, () => {
                    if (chrome.runtime.lastError) {
                        onError?.(chrome.runtime.lastError);
                        return;
                    }
                    currentStorageMode = 'local';
                    if (!localFallbackNotified) {
                        alert('Synchronisierung hat das Limit erreicht. Snippets werden jetzt lokal gespeichert.');
                        localFallbackNotified = true;
                    }
                    onSuccess?.('local');
                });
            } else {
                onError?.(chrome.runtime.lastError);
            }
        } else {
            chrome.storage.local.remove(['storageMode', 'snippets', 'categories']);
            currentStorageMode = 'sync';
            localFallbackNotified = false;
            onSuccess?.('sync');
        }
    });
}

function normalizeSnippetData(data) {
    if (typeof data === 'string') {
        return {
            variants: {
                internal: data,
                external: data
            },
            category: 'Default',
            defaultAudience: 'internal',
            requireChoice: false
        };
    }

    if (!data) {
        return {
            variants: {
                internal: '',
                external: ''
            },
            category: 'Default',
            defaultAudience: 'internal',
            requireChoice: false
        };
    }

    if (data.variants) {
        return {
            variants: {
                internal: data.variants.internal || data.variants.external || '',
                external: data.variants.external || data.variants.internal || ''
            },
            category: data.category || 'Default',
            defaultAudience: data.defaultAudience || 'internal',
            requireChoice: Boolean(data.requireChoice)
        };
    }

    const phrase = data.phrase || '';
    return {
        variants: {
            internal: phrase,
            external: phrase
        },
        category: data.category || 'Default',
        defaultAudience: data.defaultAudience || 'internal',
        requireChoice: Boolean(data.requireChoice)
    };
}

// Load data when page opens
document.addEventListener('DOMContentLoaded', loadData);

function loadData() {
    loadFromStorage(['snippets', 'categories'], (mode, result) => {
        const rawSnippets = result?.snippets || {};
        snippets = Object.fromEntries(Object.entries(rawSnippets).map(([trigger, data]) => {
            return [trigger, normalizeSnippetData(data)];
        }));
        categories = result?.categories || ['Default'];
        if (!categories.length) {
            categories = ['Default'];
        }
        currentCategory = categories[0];
        
        renderCategories();
        renderSnippets();
    });
}

function renderCategories() {
    const container = document.getElementById('categoryList');
    container.innerHTML = '';
    
    categories.forEach(category => {
        const div = document.createElement('div');
        div.className = 'category-item' + (category === currentCategory ? ' active' : '');
        div.textContent = category;
        div.onclick = () => {
            currentCategory = category;
            document.querySelectorAll('.category-item').forEach(item => item.classList.remove('active'));
            div.classList.add('active');
            renderSnippets();
        };
        
        if (category !== 'Default') {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteCategory(category);
            };
            div.appendChild(deleteBtn);
        }
        
        container.appendChild(div);
    });
}

function renderSnippets(searchTerm = '') {
    const container = document.getElementById('snippetGrid');
    container.innerHTML = '';
    
    Object.entries(snippets).forEach(([trigger, data]) => {
        if (data.category !== currentCategory) return;
        if (searchTerm && !matchesSearch(trigger, data, searchTerm)) return;
        
        const card = document.createElement('div');
        card.className = 'snippet-card';
        
        const triggerInput = document.createElement('input');
        triggerInput.type = 'text';
        triggerInput.value = trigger;
        triggerInput.placeholder = 'Trigger';
        
        const internalLabel = document.createElement('label');
        internalLabel.textContent = 'Intern (du)';
        internalLabel.style.display = 'block';
        internalLabel.style.fontSize = '12px';
        internalLabel.style.marginTop = '8px';
        
        const internalInput = document.createElement('textarea');
        internalInput.value = data.variants.internal || '';
        internalInput.placeholder = 'Text für Mitarbeitende';
        internalInput.rows = 3;
        internalInput.style.width = '100%';
        internalInput.style.resize = 'vertical';
        
        const externalLabel = document.createElement('label');
        externalLabel.textContent = 'Extern (Sie)';
        externalLabel.style.display = 'block';
        externalLabel.style.fontSize = '12px';
        externalLabel.style.marginTop = '8px';
        
        const externalInput = document.createElement('textarea');
        externalInput.value = data.variants.external || '';
        externalInput.placeholder = 'Text für Kund:innen';
        externalInput.rows = 3;
        externalInput.style.width = '100%';
        externalInput.style.resize = 'vertical';
        
        const defaultSelect = document.createElement('select');
        defaultSelect.className = 'audience-select';
        defaultSelect.innerHTML = `
            <option value="internal">Standard: Intern (du)</option>
            <option value="external">Standard: Extern (Sie)</option>
        `;
        defaultSelect.value = data.defaultAudience === 'external' ? 'external' : 'internal';

        const choiceLabel = document.createElement('label');
        choiceLabel.className = 'audience-toggle';
        const choiceCheckbox = document.createElement('input');
        choiceCheckbox.type = 'checkbox';
        choiceCheckbox.checked = Boolean(data.requireChoice);
        const choiceText = document.createElement('span');
        choiceText.textContent = 'Beim Einfügen Variante auswählen';
        choiceLabel.appendChild(choiceCheckbox);
        choiceLabel.appendChild(choiceText);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        
        [triggerInput, internalInput, externalInput, defaultSelect, choiceCheckbox].forEach(input => {
            input.addEventListener('change', () => updateSnippet(
                trigger,
                triggerInput.value,
                internalInput.value,
                externalInput.value,
                defaultSelect.value,
                choiceCheckbox.checked
            ));
        });
        
        deleteBtn.onclick = () => deleteSnippet(trigger);
        
        card.appendChild(triggerInput);
        card.appendChild(internalLabel);
        card.appendChild(internalInput);
        card.appendChild(externalLabel);
        card.appendChild(externalInput);
        card.appendChild(defaultSelect);
        card.appendChild(choiceLabel);
        card.appendChild(deleteBtn);
        container.appendChild(card);
    });
}

function matchesSearch(trigger, data, search) {
    search = search.toLowerCase();
    const content = [
        trigger,
        data.variants.internal || '',
        data.variants.external || ''
    ].join(' ').toLowerCase();
    return content.includes(search);
}

function updateSnippet(oldTrigger, newTrigger, internalValue, externalValue, defaultAudience, requireChoice) {
    if (oldTrigger !== newTrigger) {
        delete snippets[oldTrigger];
    }
    snippets[newTrigger] = {
        variants: {
            internal: internalValue || externalValue || '',
            external: externalValue || internalValue || ''
        },
        defaultAudience: defaultAudience === 'external' ? 'external' : 'internal',
        requireChoice: Boolean(requireChoice),
        category: currentCategory
    };
    saveData();
}

function deleteSnippet(trigger) {
    delete snippets[trigger];
    saveData();
    renderSnippets();
}

function deleteCategory(category) {
    if (!confirm(`Delete category "${category}" and all its snippets?`)) return;
    
    // Remove snippets in this category
    Object.entries(snippets).forEach(([trigger, data]) => {
        if (data.category === category) {
            delete snippets[trigger];
        }
    });
    
    // Remove category
    categories = categories.filter(c => c !== category);
    currentCategory = 'Default';
    
    saveData();
    renderCategories();
    renderSnippets();
}

function saveData() {
    const payload = {
        snippets: snippets,
        categories: categories
    };
    saveToStorage(payload, mode => {
        console.log('Data saved to', mode, 'storage');
    }, error => {
        console.error('Error saving data:', error);
        alert('Konnte Snippets nicht speichern: ' + (error?.message || error));
    });
}

// Event Listeners
document.getElementById('addCategory').onclick = () => {
    const name = prompt('Enter category name:');
    if (name && !categories.includes(name)) {
        categories.push(name);
        saveData();
        renderCategories();
    }
};

document.getElementById('addSnippet').onclick = () => {
    const trigger = prompt('Enter trigger text:');
    if (trigger) {
        snippets[trigger] = {
            variants: {
                internal: '',
                external: ''
            },
            requireChoice: false,
            defaultAudience: 'internal',
            category: currentCategory
        };
        saveData();
        renderSnippets();
    }
};

document.getElementById('searchInput').addEventListener('input', (e) => {
    renderSnippets(e.target.value);
});

// Import/Export functionality
document.getElementById('importExportBtn').onclick = () => {
    const modal = document.getElementById('importExport');
    const backdrop = document.getElementById('modalBackdrop');
    const textarea = document.getElementById('importExportData');
    
    textarea.value = JSON.stringify({ snippets, categories }, null, 2);
    modal.style.display = 'block';
    backdrop.style.display = 'block';
};

document.getElementById('cancelImportExport').onclick = () => {
    const modal = document.getElementById('importExport');
    const backdrop = document.getElementById('modalBackdrop');
    modal.style.display = 'none';
    backdrop.style.display = 'none';
};

document.getElementById('confirmImportExport').onclick = () => {
    const textarea = document.getElementById('importExportData');
    try {
        const data = JSON.parse(textarea.value);
        if (data.snippets && data.categories) {
            snippets = Object.fromEntries(Object.entries(data.snippets).map(([trigger, value]) => {
                return [trigger, normalizeSnippetData(value)];
            }));
            categories = data.categories;
            saveData();
            renderCategories();
            renderSnippets();
            document.getElementById('cancelImportExport').click();
        }
    } catch (e) {
        alert('Invalid JSON data');
    }
}; 
