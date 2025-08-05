let snippets = {};
let categories = ['Default'];
let currentCategory = 'Default';

// Load data when page opens
document.addEventListener('DOMContentLoaded', loadData);

function loadData() {
    chrome.storage.sync.get(['snippets', 'categories'], function(result) {
        snippets = result.snippets || {};
        categories = result.categories || ['Default'];
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
        if (searchTerm && !matchesSearch(trigger, data.phrase, searchTerm)) return;
        
        const card = document.createElement('div');
        card.className = 'snippet-card';
        
        const triggerInput = document.createElement('input');
        triggerInput.type = 'text';
        triggerInput.value = trigger;
        triggerInput.placeholder = 'Trigger';
        
        const phraseInput = document.createElement('textarea');
        phraseInput.value = data.phrase;
        phraseInput.placeholder = 'Expanded Text';
        phraseInput.rows = 3;
        phraseInput.style.width = '100%';
        phraseInput.style.resize = 'vertical';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        
        [triggerInput, phraseInput].forEach(input => {
            input.addEventListener('change', () => updateSnippet(trigger, triggerInput.value, phraseInput.value));
        });
        
        deleteBtn.onclick = () => deleteSnippet(trigger);
        
        card.appendChild(triggerInput);
        card.appendChild(phraseInput);
        card.appendChild(deleteBtn);
        container.appendChild(card);
    });
}

function matchesSearch(trigger, phrase, search) {
    search = search.toLowerCase();
    return trigger.toLowerCase().includes(search) || 
           phrase.toLowerCase().includes(search);
}

function updateSnippet(oldTrigger, newTrigger, phrase) {
    if (oldTrigger !== newTrigger) {
        delete snippets[oldTrigger];
    }
    snippets[newTrigger] = {
        phrase: phrase,
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
    chrome.storage.sync.set({ 
        snippets: snippets,
        categories: categories
    }, function() {
        console.log('Data saved');
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
            phrase: '',
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
            snippets = data.snippets;
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