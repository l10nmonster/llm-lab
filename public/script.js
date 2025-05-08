// public/script.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('llm-form');
    const addTranslatorBtn = document.getElementById('add-translator-btn');
    const translatorsContainer = document.getElementById('translators-container');
    const translatorTemplate = document.getElementById('translator-template');
    const submitBtn = document.getElementById('submit-btn');
    const statusMessageEl = document.getElementById('status-message');
    const loadingAnimationEl = document.getElementById('loading-animation');

    let availableProviders = [];
    let translatorIdCounter = 0;

    // --- Helper to parse Google Sheet URL ---
    function parseSheetUrl(url) {
        // Regex to capture spreadsheet ID and GID (sheet ID)
        // Example: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=SHEET_GID
        // Example: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/
        // Example: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
        const regex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)(?:\/edit)?(?:#gid=([0-9]+))?/;
        const match = url.match(regex);

        if (match) {
            return {
                spreadsheetId: match[1],
                gid: match[2] || '0', // Default to '0' if gid is not present (first sheet)
            };
        }
        return null; // Invalid URL format
    }


    // --- Fetch Providers (same as before) ---
    async function fetchProviders() {
        try {
            const response = await fetch('/api/providers'); // Ensure API prefix
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            availableProviders = await response.json();
            console.log('Providers fetched:', availableProviders);
            addTranslatorSection(); // Add first section
            updateAllProviderDropdowns();
        } catch (error) {
            console.error('Error fetching providers:', error);
            statusMessageEl.textContent = 'Error loading providers. Please refresh.';
            statusMessageEl.className = 'error';
            addTranslatorBtn.disabled = true;
        }
    }

    function populateProviderDropdown(selectElement) {
        const placeholder = selectElement.querySelector('option[disabled]');
        selectElement.innerHTML = '';
        if (placeholder) {
             selectElement.appendChild(placeholder);
             placeholder.textContent = 'Select a provider...';
        } else {
             const defaultOption = document.createElement('option');
             defaultOption.value = "";
             defaultOption.textContent = "Select a provider...";
             defaultOption.disabled = true;
             defaultOption.selected = true;
             selectElement.appendChild(defaultOption);
        }
        availableProviders.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider;
            option.textContent = provider;
            selectElement.appendChild(option);
        });
    }

    function updateAllProviderDropdowns() {
        translatorsContainer.querySelectorAll('.provider-select').forEach(select => {
           if (select.options.length <= 1) {
               populateProviderDropdown(select);
           }
        });
    }

    function addTranslatorSection() {
        translatorIdCounter++;
        const templateContent = translatorTemplate.content.cloneNode(true);
        const newSection = templateContent.querySelector('.translator-section');

        newSection.querySelector('.provider-select').id = `provider-select-${translatorIdCounter}`;
        newSection.querySelector('label[for^="provider-select"]').htmlFor = `provider-select-${translatorIdCounter}`;
        newSection.querySelector('.instructions-textarea').id = `instructions-${translatorIdCounter}`;
        newSection.querySelector('label[for^="instructions"]').htmlFor = `instructions-${translatorIdCounter}`;

        const selectElement = newSection.querySelector('.provider-select');
        populateProviderDropdown(selectElement);

        const removeBtn = newSection.querySelector('.remove-translator-btn');
        removeBtn.addEventListener('click', () => {
            newSection.remove();
        });
        translatorsContainer.appendChild(newSection);
    }

    addTranslatorBtn.addEventListener('click', addTranslatorSection);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('Form submission triggered');

        submitBtn.disabled = true;
        loadingAnimationEl.classList.remove('loading-hidden');
        statusMessageEl.textContent = '';
        statusMessageEl.className = '';

        // --- Get URL and parse it ---
        const sheetUrlInput = document.getElementById('sheet-url').value;
        const parsedUrl = parseSheetUrl(sheetUrlInput);

        if (!parsedUrl) {
            statusMessageEl.textContent = 'Invalid Google Sheet URL format.';
            statusMessageEl.className = 'error';
            submitBtn.disabled = false;
            loadingAnimationEl.classList.add('loading-hidden');
            return;
        }

        const formData = new FormData(form);
        const fixedData = {
            spreadsheetId: parsedUrl.spreadsheetId,
            gid: parsedUrl.gid, // Send GID (Sheet ID) instead of title
            testName: formData.get('testName'),
            sourceLanguage: formData.get('sourceLanguage'),
            targetLanguage: formData.get('targetLanguage'),
            sourceColumn: formData.get('sourceColumn').toUpperCase(), // Standardize to uppercase
            notesColumn: formData.get('notesColumn') ? formData.get('notesColumn').toUpperCase() : null,
            startRow: parseInt(formData.get('startRow'), 10),
            endRow: formData.get('endRow') ? parseInt(formData.get('endRow'), 10) : null,
        };

        const translators = [];
        const translatorSections = translatorsContainer.querySelectorAll('.translator-section');
        translatorSections.forEach(section => {
            const providerSelect = section.querySelector('.provider-select');
            const instructionsTextarea = section.querySelector('.instructions-textarea');
            if (providerSelect && instructionsTextarea) {
                translators.push({
                    provider: providerSelect.value,
                    instructions: instructionsTextarea.value
                });
            }
        });

        const submissionData = {
            ...fixedData,
            translators: translators
        };

        console.log('Submitting data:', JSON.stringify(submissionData, null, 2));

        try {
            const response = await fetch('/api/project', { // Ensure API prefix
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submissionData),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || `HTTP error! Status: ${response.status}`);
            }
            console.log('Submission successful:', result);
            statusMessageEl.textContent = result.message || 'Success!';
            statusMessageEl.className = 'success';
            if (result.sheetUrl) {
                const link = document.createElement('a');
                link.href = result.sheetUrl;
                link.target = '_blank';
                link.textContent = result.sheetName;
                statusMessageEl.appendChild(link);
            }

        } catch (error) {
            console.error('Submission error:', error);
            statusMessageEl.textContent = `Error: ${error.message || 'Could not connect to server.'}`;
            statusMessageEl.className = 'error';
        } finally {
            submitBtn.disabled = false;
            loadingAnimationEl.classList.add('loading-hidden');
        }
    });

    fetchProviders();
});
