// Get the variables and text from the URL parameters
const urlParams = new URLSearchParams(window.location.search);
const text = urlParams.get('text');
const elementId = urlParams.get('elementId');
const variables = [...new Set(text.match(/\{\{([^}]+)\}\}/g)?.map(v => v.slice(2, -2)) || [])];

// Create input fields for each variable
const form = document.getElementById('variableForm');
variables.forEach(variable => {
    const div = document.createElement('div');
    div.className = 'variable-input';
    
    const label = document.createElement('label');
    label.textContent = variable;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Enter ${variable}`;
    input.dataset.variable = variable;
    
    div.appendChild(label);
    div.appendChild(input);
    form.appendChild(div);
});

// Focus first input
const firstInput = document.querySelector('input');
if (firstInput) firstInput.focus();

// Handle form submission
document.getElementById('submitBtn').addEventListener('click', () => {
    const values = {};
    document.querySelectorAll('input').forEach(input => {
        values[input.dataset.variable] = input.value || input.dataset.variable;
    });
    
    // Replace variables in text
    let finalText = text;
    Object.entries(values).forEach(([variable, value]) => {
        const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
        finalText = finalText.replace(regex, value);
    });
    
    console.log('Sending message with:', {
        action: 'fillVariables',
        text: finalText,
        elementId: elementId
    });

    // Send message to content script through background script
    chrome.runtime.sendMessage({
        action: 'fillVariablesFromPopup',
        data: {
            text: finalText,
            elementId: elementId
        }
    }, response => {
        if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            alert('Error sending data. Please try again.');
        } else {
            console.log('Message sent successfully:', response);
            window.close();
        }
    });
});

// Handle Enter key in inputs
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submitBtn').click();
        }
    });
});

// Handle cancel
document.getElementById('cancelBtn').addEventListener('click', () => {
    window.close();
}); 