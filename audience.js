const urlParams = new URLSearchParams(window.location.search);
const elementId = urlParams.get('elementId');

let audienceData = null;
let selectedVariant = null;

function requestAudienceData() {
    chrome.runtime.sendMessage({
        action: 'getAudienceData',
        elementId: elementId
    }, response => {
        if (chrome.runtime.lastError || !response || !response.success) {
            showError('Snippet konnte nicht geladen werden.');
            return;
        }
        audienceData = response.data;
        renderOptions();
    });
}

function showError(text) {
    const options = document.getElementById('options');
    options.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'loading';
    div.textContent = text;
    options.appendChild(div);
    document.getElementById('confirmBtn').disabled = true;
}

function renderOptions() {
    const options = document.getElementById('options');
    options.innerHTML = '';

    const variants = audienceData.variants || {};
    const defaultAudience = audienceData.defaultAudience === 'external' ? 'external' : 'internal';

    ['internal', 'external'].forEach(variantKey => {
        const text = variants[variantKey];
        if (!text) {
            return;
        }

        const card = document.createElement('div');
        card.className = 'option-card';
        card.dataset.variant = variantKey;

        const header = document.createElement('div');
        header.className = 'option-header';
        header.textContent = variantKey === 'internal' ? 'Intern (du)' : 'Extern (Sie)';

        const preview = document.createElement('div');
        preview.className = 'preview';
        preview.textContent = text;

        card.appendChild(header);
        card.appendChild(preview);
        card.addEventListener('click', () => selectVariant(variantKey, card));
        options.appendChild(card);

        if (!selectedVariant && variantKey === defaultAudience) {
            selectVariant(variantKey, card);
        }
    });

    if (!selectedVariant) {
        const availableVariant = ['internal', 'external'].find(key => variants[key]);
        if (availableVariant) {
            const card = options.querySelector(`.option-card[data-variant="${availableVariant}"]`);
            if (card) {
                selectVariant(availableVariant, card);
            }
        }
    }
}

function selectVariant(variantKey, card) {
    selectedVariant = variantKey;
    document.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
    card.classList.add('selected');
    document.getElementById('confirmBtn').disabled = false;
}

function confirmSelection() {
    if (!selectedVariant || !audienceData) return;

    chrome.runtime.sendMessage({
        action: 'audienceSelection',
        data: {
            elementId: elementId,
            variant: selectedVariant
        }
    }, () => {
        window.close();
    });
}

function cancelSelection() {
    chrome.runtime.sendMessage({
        action: 'audienceCancelled',
        elementId: elementId
    }, () => {
        window.close();
    });
}

document.getElementById('confirmBtn').addEventListener('click', confirmSelection);
document.getElementById('cancelBtn').addEventListener('click', cancelSelection);

window.addEventListener('load', requestAudienceData);
window.addEventListener('beforeunload', () => {
    if (!selectedVariant) {
        chrome.runtime.sendMessage({
            action: 'audienceCancelled',
            elementId: elementId
        });
    }
});
