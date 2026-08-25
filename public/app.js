document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let apiKeys = JSON.parse(localStorage.getItem('groqApiKeys') || '[]');
    let uploadedFiles = [];
    let isGenerating = false;
    let stopGeneration = false;
    let wakeLock = null;
    let keepAliveAudioCtx = null;
    let keepAliveOsc = null;

    // --- IndexedDB & Background Keep-Alive Helpers ---
    const DB_NAME = 'DesignInk_MetadataSessionDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'generated_results';

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function saveResultToDB(fileObj) {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const record = {
                id: fileObj.id,
                name: fileObj.name,
                size: fileObj.size,
                status: fileObj.status,
                result: fileObj.result,
                url: fileObj.url && fileObj.url.startsWith('data:') ? fileObj.url : null,
                timestamp: Date.now()
            };
            store.put(record);
        } catch (e) {
            console.warn('Failed to save metadata to IndexedDB:', e);
        }
    }

    async function loadResultsFromDB() {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            return new Promise((resolve) => {
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        } catch (e) {
            console.warn('Failed to load metadata from IndexedDB:', e);
            return [];
        }
    }

    async function clearDBResults() {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.clear();
        } catch (e) {
            console.warn('Failed to clear IndexedDB:', e);
        }
    }

    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock acquired to prevent tab sleeping.');
            }
        } catch (err) {
            console.warn('Wake Lock error:', err);
        }
    }

    function releaseWakeLock() {
        if (wakeLock !== null) {
            wakeLock.release().then(() => { wakeLock = null; }).catch(() => {});
        }
    }

    function startKeepAliveAudio() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            if (!keepAliveAudioCtx) keepAliveAudioCtx = new AudioContext();
            if (keepAliveAudioCtx.state === 'suspended') keepAliveAudioCtx.resume();
            
            keepAliveOsc = keepAliveAudioCtx.createOscillator();
            const gain = keepAliveAudioCtx.createGain();
            gain.gain.value = 0.00001; // silent audio to maintain background tab execution
            keepAliveOsc.connect(gain);
            gain.connect(keepAliveAudioCtx.destination);
            keepAliveOsc.start();
        } catch (e) {
            console.warn('Keep-alive audio error:', e);
        }
    }

    function stopKeepAliveAudio() {
        try {
            if (keepAliveOsc) {
                keepAliveOsc.stop();
                keepAliveOsc.disconnect();
                keepAliveOsc = null;
            }
        } catch (e) {}
    }

    // Warn before unloading if generation is active
    window.addEventListener('beforeunload', (e) => {
        if (isGenerating) {
            e.preventDefault();
            e.returnValue = 'Metadata generation is currently running. Leaving this page will pause background generation!';
            return e.returnValue;
        }
    });

    // Restore saved session from IndexedDB on page load
    async function restoreSavedSession() {
        const savedRecords = await loadResultsFromDB();
        if (savedRecords && savedRecords.length > 0) {
            uploadedFiles = savedRecords.map(rec => ({
                id: rec.id || ('file_' + Math.random().toString(36).substr(2, 9)),
                file: null,
                name: rec.name,
                size: rec.size || 'Saved Result',
                url: rec.url || 'icon.png',
                status: rec.status || 'success',
                result: rec.result
            }));
            
            if (resultsSection) resultsSection.style.display = 'block';
            if (resultsList) resultsList.innerHTML = '';
            uploadedFiles.forEach(f => {
                if (f.status === 'success' && f.result) {
                    addResultToUI(f);
                }
            });
            
            renderFilesList();
            updateGenerateBtn();
            console.log(`Restored ${savedRecords.length} metadata results from IndexedDB session.`);
        }
    }
    
    // Auto restore session on load
    setTimeout(() => { restoreSavedSession(); }, 300);

    // --- DOM Elements ---
    const apiKeyInput = document.getElementById('apiKey');
    const verifyApiKeyBtn = document.getElementById('verifyApiKeyBtn');
    const apiKeysList = document.getElementById('apiKeysList');
    const keyCounter = document.getElementById('keyCounter');
    const apiKeyPlaceholder = document.getElementById('apiKeyPlaceholder');
    const apiKeyInputContainer = document.getElementById('apiKeyInputContainer');
    const addApiKeyBtn = document.getElementById('addApiKeyBtn');
    const cancelApiKeyBtn = document.getElementById('cancelApiKeyBtn');
    const apiKeyNotification = document.getElementById('apiKeyNotification');
    const addMoreContainer = document.getElementById('addMoreContainer');
    const addMoreApiKeyBtn = document.getElementById('addMoreApiKeyBtn');
    
    const imageInput = document.getElementById('imageInput');
    const uploadArea = document.getElementById('uploadArea');
    const browseBtn = document.getElementById('browseBtn');
    const uploadedFilesList = document.getElementById('uploadedFilesList');
    const filesCount = document.getElementById('filesCount');
    const counterText = document.getElementById('counterText');
    const clearAllBtn = document.getElementById('clearAllBtn');
    
    // Settings
    const titleLength = document.getElementById('titleLength');
    const titleLengthValue = document.getElementById('titleLengthValue');
    const keywordsCount = document.getElementById('keywordsCount');
    const keywordsCountValue = document.getElementById('keywordsCountValue');
    const descriptionLength = document.getElementById('descriptionLength');
    const descriptionLengthValue = document.getElementById('descriptionLengthValue');
    
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsTooltip = document.getElementById('settingsTooltip');
    const settingsTooltipClose = document.getElementById('settingsTooltipClose');
    
    const filenameAsTitle = document.getElementById('filenameAsTitle');
    const includeKeywords = document.getElementById('includeKeywords');
    const excludeKeywords = document.getElementById('excludeKeywords');
    const modelSelect = document.getElementById('modelSelect');
    const selectedModelName = document.getElementById('selectedModelName');
    
    const generateBtn = document.getElementById('generateBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    
    const progressHeader = document.getElementById('progressHeader');
    const completedCountEl = document.getElementById('completedCount');
    const totalCountEl = document.getElementById('totalCount');
    const currentFileName = document.getElementById('currentFileName');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const stopBtn = document.getElementById('stopBtn');
    
    const resultsSection = document.getElementById('resultsSection');
    const resultsList = document.getElementById('resultsList');
    const uploadNewBtn = document.getElementById('uploadNewBtn');
    
    // Dropdown Header Logic
    document.querySelector('.metadata-gen-dropdown-header')?.addEventListener('click', function() {
        this.parentElement.classList.toggle('open');
    });

    // --- API Key Management ---
    function updateKeyUI() {
        if (keyCounter) {
            keyCounter.textContent = `${apiKeys.length} / 50 Active Keys`;
        }
        if (apiKeys.length === 0) {
            apiKeyPlaceholder.style.display = 'block';
            apiKeyInputContainer.style.display = 'none';
            apiKeysList.style.display = 'none';
            addMoreContainer.style.display = 'none';
            apiKeyNotification.style.display = 'flex';
        } else {
            apiKeyPlaceholder.style.display = 'none';
            apiKeyInputContainer.style.display = 'none';
            apiKeysList.style.display = 'block';
            addMoreContainer.style.display = apiKeys.length < 50 ? 'block' : 'none';
            apiKeyNotification.style.display = 'none';
            
            apiKeysList.innerHTML = '';
            apiKeys.forEach((key, index) => {
                const mask = key.slice(0, 5) + '...' + key.slice(-4);
                let providerIcon = '<i class="fas fa-key" style="color:var(--accent-glow);"></i>';
                let providerLabel = 'Key';
                
                if (key.startsWith('AIza') || key.startsWith('AQ')) {
                    providerIcon = '<i class="fab fa-google" style="color:#34d399;"></i>';
                    providerLabel = 'Gemini';
                } else if (key.startsWith('ghp_') || key.startsWith('github_pat_')) {
                    providerIcon = '<i class="fab fa-github" style="color:#c084fc;"></i>';
                    providerLabel = 'GitHub PAT';
                } else if (key.startsWith('sk-or-')) {
                    providerIcon = '<i class="fas fa-network-wired" style="color:#60a5fa;"></i>';
                    providerLabel = 'OpenRouter';
                } else if (key.startsWith('gsk_')) {
                    providerIcon = '<i class="fas fa-bolt" style="color:#f59e0b;"></i>';
                    providerLabel = 'Groq';
                }

                const item = document.createElement('div');
                item.className = 'metadata-gen-api-key-item';
                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; border:1px solid rgba(255,255,255,0.1); background:rgba(15,23,42,0.6); padding:10px 14px; border-radius:10px; margin-bottom:8px;">
                        <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${providerIcon} ${providerLabel} ${index + 1}: <code style="color:var(--text-muted); font-size:0.8rem;">${mask}</code></span>
                        <button class="remove-key-btn" data-index="${index}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.9rem;" title="Remove Key"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                apiKeysList.appendChild(item);
            });
            
            document.querySelectorAll('.remove-key-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
                    apiKeys.splice(idx, 1);
                    localStorage.setItem('groqApiKeys', JSON.stringify(apiKeys));
                    updateKeyUI();
                    updateGenerateBtn();
                });
            });
        }
        updateGenerateBtn();
    }
    
    addApiKeyBtn?.addEventListener('click', () => {
        apiKeyPlaceholder.style.display = 'none';
        apiKeyInputContainer.style.display = 'block';
    });
    
    addMoreApiKeyBtn?.addEventListener('click', () => {
        apiKeyInputContainer.style.display = 'block';
        addMoreContainer.style.display = 'none';
    });
    
    cancelApiKeyBtn?.addEventListener('click', () => updateKeyUI());
    
    verifyApiKeyBtn?.addEventListener('click', () => {
        const rawInput = apiKeyInput.value.trim();
        if (!rawInput) return;

        // Split by newlines, commas, or spaces to support Bulk Key Addition!
        const candidateKeys = rawInput.split(/[\n,\s]+/).map(k => k.trim()).filter(k => k.length >= 10);
        let addedCount = 0;

        candidateKeys.forEach(val => {
            const isValidFormat = val.length >= 8;

            if (isValidFormat && apiKeys.length < 50 && !apiKeys.includes(val)) {
                apiKeys.push(val);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            localStorage.setItem('groqApiKeys', JSON.stringify(apiKeys));
            apiKeyInput.value = '';
            updateKeyUI();
            
            if (typeof window.showToast === 'function') {
                window.showToast(`Successfully added ${addedCount} API key(s) to Multi-AI Pool!`, 'success');
            }
        } else if (candidateKeys.length > 0 && apiKeys.length >= 50) {
            alert('Maximum 50 Multi-AI provider keys reached.');
        } else {
            alert('Please enter valid API keys (Groq gsk_, Gemini AIza, GitHub PAT ghp_, or OpenRouter sk-or-). Multiple keys can be separated by commas or newlines.');
        }
    });
    
    updateKeyUI();

    // --- Settings UI ---
    titleLength?.addEventListener('input', e => titleLengthValue.textContent = e.target.value);
    keywordsCount?.addEventListener('input', e => keywordsCountValue.textContent = e.target.value);
    descriptionLength?.addEventListener('input', e => descriptionLengthValue.textContent = e.target.value);
    
    settingsBtn?.addEventListener('click', () => {
        settingsTooltip.style.display = settingsTooltip.style.display === 'block' ? 'none' : 'block';
    });
    settingsTooltipClose?.addEventListener('click', () => settingsTooltip.style.display = 'none');
    
    // --- Model Selection UI ---
    modelSelect?.addEventListener('change', (e) => {
        if (selectedModelName) {
            selectedModelName.textContent = e.target.options[e.target.selectedIndex].text;
        }
    });
    
    // --- File Handling ---
    uploadArea?.addEventListener('click', () => imageInput.click());
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.style.borderColor = '#3486D2', false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.style.borderColor = '#ccc', false);
    });
    
    uploadArea.addEventListener('drop', (e) => {
        let dt = e.dataTransfer;
        let files = dt.files;
        handleFiles(files);
    });
    
    imageInput?.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    function handleFiles(files) {
        if (!files.length) return;
        
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const id = 'file_' + Math.random().toString(36).substr(2, 9);
                uploadedFiles.push({
                    id,
                    file,
                    name: file.name,
                    size: (file.size / 1024).toFixed(1) + ' KB',
                    url: URL.createObjectURL(file),
                    status: 'pending', // pending, processing, success, error
                    result: null
                });
            }
        });
        
        renderFilesList();
        updateGenerateBtn();
    }
    
    function renderFilesList() {
        filesCount.textContent = `${uploadedFiles.length} files`;
        counterText.textContent = `${uploadedFiles.length}/500`;
        clearAllBtn.disabled = uploadedFiles.length === 0;
        
        if (uploadedFiles.length === 0) {
            uploadedFilesList.innerHTML = `<div class="metadata-gen-files-empty"><i class="fas fa-folder-open"></i><span>No files uploaded yet</span></div>`;
            return;
        }
        
        uploadedFilesList.innerHTML = '';
        uploadedFiles.forEach(fileObj => {
            const item = document.createElement('div');
            item.className = 'metadata-gen-file-item';
            item.id = fileObj.id;
            
            let statusIcon = '<i class="fas fa-clock" style="color:gray;"></i>';
            if (fileObj.status === 'processing') statusIcon = '<i class="fas fa-spinner fa-spin" style="color:blue;"></i>';
            if (fileObj.status === 'success') statusIcon = '<i class="fas fa-check-circle" style="color:green;"></i>';
            if (fileObj.status === 'error') statusIcon = '<i class="fas fa-exclamation-circle" style="color:red;"></i>';
            
            item.innerHTML = `
                <div style="display:flex; align-items:center; width:100%; border:1px solid #eee; padding:5px; margin-bottom:5px; border-radius:4px;">
                    <img src="${fileObj.url}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; margin-right:10px;">
                    <div style="flex-grow:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${fileObj.name}">
                        ${fileObj.name} <br> <small>${fileObj.size}</small>
                    </div>
                    <div style="margin-left:10px;" class="status-icon">${statusIcon}</div>
                    <button class="remove-file-btn" data-id="${fileObj.id}" style="background:none; border:none; color:red; cursor:pointer; margin-left:10px;"><i class="fas fa-times"></i></button>
                </div>
            `;
            uploadedFilesList.appendChild(item);
        });
        
        document.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const idx = uploadedFiles.findIndex(f => f.id === id);
                if (idx !== -1) {
                    URL.revokeObjectURL(uploadedFiles[idx].url);
                    uploadedFiles.splice(idx, 1);
                    renderFilesList();
                    updateGenerateBtn();
                }
            });
        });
    }
    
    clearAllBtn?.addEventListener('click', async () => {
        uploadedFiles.forEach(f => {
            if (f.url && f.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
        });
        uploadedFiles = [];
        await clearDBResults();
        if (resultsList) resultsList.innerHTML = '';
        if (resultsSection) resultsSection.style.display = 'none';
        if (progressHeader) progressHeader.style.display = 'none';
        renderFilesList();
        updateGenerateBtn();
    });
    
    function updateGenerateBtn() {
        const isReady = (uploadedFiles.length > 0 && !isGenerating);
        document.querySelectorAll('.start-gen-btn').forEach(btn => {
            btn.disabled = !isReady;
        });
        if (generateBtn) generateBtn.disabled = !isReady;
        
        const hasSuccess = uploadedFiles.some(f => f.status === 'success');
        if (exportCsvBtn) exportCsvBtn.disabled = !hasSuccess;
    }
    
    // --- Image Compression & Base64 Conversion ---
    // --- Image Compression & Base64 Conversion for Vision AI Models ---
    function compressImageToBase64(fileSource) {
        return new Promise((resolve, reject) => {
            if (!fileSource) {
                return reject(new Error("No image file or URL available for Vision AI model analysis"));
            }

            const img = new Image();
            img.crossOrigin = "Anonymous";

            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; // Optimized clarity size for AI vision model inspection
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height = Math.round(height * (MAX_WIDTH / width));
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width = Math.round(width * (MAX_HEIGHT / height));
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = "#FFFFFF"; // Fill transparent backgrounds
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, width, height);

                    let quality = 0.75;
                    let dataUrl = canvas.toDataURL('image/jpeg', quality);
                    let b64 = dataUrl.split(',')[1];
                    
                    // Priority 3: Hard cap Base64 string under 1MB to eliminate Vercel HTTP 413 errors
                    while (b64 && b64.length > 1000000 && quality > 0.3) {
                        quality -= 0.15;
                        dataUrl = canvas.toDataURL('image/jpeg', quality);
                        b64 = dataUrl.split(',')[1];
                    }

                    if (!b64) {
                        return reject(new Error("Failed to extract Base64 data from image canvas"));
                    }
                    resolve({
                        b64,
                        mimeType: 'image/jpeg'
                    });
                } catch(e) {
                    reject(e);
                }
            };

            img.onerror = function() {
                reject(new Error("Failed to render image onto canvas for Vision AI processing"));
            };

            if (fileSource instanceof File || fileSource instanceof Blob) {
                const reader = new FileReader();
                reader.onload = e => { img.src = e.target.result; };
                reader.onerror = e => reject(e);
                reader.readAsDataURL(fileSource);
            } else if (typeof fileSource === 'string') {
                img.src = fileSource;
            } else {
                reject(new Error("Unsupported image source format"));
            }
        });
    }
    
    // Make it globally available for other modules like the Image Auditor
    window.compressImageToBase64 = compressImageToBase64;

    // --- Generation Logic ---
    async function startMetadataGeneration() {
        if (isGenerating) return;
        isGenerating = true;
        stopGeneration = false;
        requestWakeLock();
        startKeepAliveAudio();
        updateGenerateBtn();
        
        progressHeader.style.display = 'block';
        resultsSection.style.display = 'block';
        
        // Build queue of files that still need processing
        const queue = uploadedFiles.filter(f => f.status !== 'success');
        const totalToProcess = uploadedFiles.length;
        let completed = uploadedFiles.filter(f => f.status === 'success').length;
        
        totalCountEl.textContent = totalToProcess;
        completedCountEl.textContent = completed;
        progressBarFill.style.width = (completed / totalToProcess * 100) + '%';
        progressPercentage.textContent = Math.round(completed / totalToProcess * 100) + '%';
        
        resultsList.innerHTML = '';

        const currentModelValue = modelSelect ? modelSelect.value : 'gemini-2.5-flash';

        // --- Helper: process a single file with a given API key ---
        async function processFile(fileObj, apiKey) {
            fileObj.status = 'processing';
            renderFilesList();
            currentFileName.textContent = fileObj.name;

            // Extract Base64 image payload from file object or image URL
            const imageSource = fileObj.file || fileObj.url;
            const { b64, mimeType } = await compressImageToBase64(imageSource);
            if (!b64) {
                throw new Error("Could not load image payload for Vision AI model analysis.");
            }

            const targetKeywordsCount = Math.max(parseInt(keywordsCountValue ? keywordsCountValue.textContent : '45', 10) || 45, 45);
            const targetTitleLength = Math.min(parseInt(titleLengthValue ? titleLengthValue.textContent : '150', 10) || 150, 150);
            const targetDescLength = parseInt(descriptionLengthValue ? descriptionLengthValue.textContent : '150', 10) || 150;

            const prompt = `You are an elite, highly experienced stock agency metadata generator (Adobe Stock, Shutterstock, Freepik, Getty Images).
LOOK AT THE PROVIDED IMAGE VERY CAREFULLY AND READ ALL VISUAL DETAILS (subject, colors, lighting, art style, composition, objects, backdrop).

Generate top-performing SEO stock metadata based EXCLUSIVELY on what you visually see in the image:

Filename / Topic Hint: "${fileObj.name}"

STRICT RULES:
1. Title: Must be ONE single, complete, natural, and highly descriptive SEO title (maximum 150 characters). Describe what is visually shown in the image (subject, colors, lighting, art style). Target length: 90 to 140 characters. DO NOT output short half-titles. DO NOT use ellipsis (...) or cut-off words.
2. Description: Detailed description around ${targetDescLength} characters describing what is visually shown in the image.
3. Keywords: You MUST generate AT LEAST ${targetKeywordsCount} unique, highly relevant, comma-separated keywords (up to 50 keywords). Cover visual subject, style, mood, concept, lighting, composition, color palette, and technical elements. Do NOT stop early.
4. Include these required keywords: "${includeKeywords ? includeKeywords.value : ''}".
5. Exclude these banned keywords: "${excludeKeywords ? excludeKeywords.value : ''}".

Respond ONLY with a valid raw JSON object in this exact format, without markdown backticks:
{
  "title": "...",
  "description": "...",
  "keywords": "k1, k2, k3"
}`;

            let data = null;
            try {
                const httpRes = await fetch('/api/groqProxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiKey,
                        model: currentModelValue,
                        messages: [{
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                ...(b64 ? [{ type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } }] : [])
                            ]
                        }],
                        temperature: 0.4,
                        response_format: { type: "json_object" }
                    })
                });

                if (httpRes.status === 413) {
                    if (typeof showToast === 'function') {
                        showToast("Image payload too large after compression. Please try a smaller image.", "error");
                    }
                    throw new Error("HTTP 413: Image payload too large for serverless endpoint.");
                }

                if (httpRes.ok) {
                    data = await httpRes.json();
                }
            } catch(fetchErr) {
                console.warn(`API call for ${fileObj.name} encountered issue:`, fetchErr);
                if (fetchErr.message.includes("413")) throw fetchErr;
            }

            // Priority 4: Surface error banner/toast when dummy fallback data is returned
            if (data?.fallback || data?.isFallback) {
                fileObj.isFallback = true;
                if (typeof showToast === 'function') {
                    showToast("AI vision call failed (rate limit or API issue). Showing placeholder metadata — try adding your own Gemini API key in Settings.", "warning");
                }
            }

            const resultText = data?.choices?.[0]?.message?.content || "";
            let parsedResult = null;

            if (resultText) {
                let cleanText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
                try {
                    parsedResult = JSON.parse(cleanText);
                } catch(e) {}

                if (!parsedResult) {
                    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            let sanitized = jsonMatch[0].replace(/,\s*([\}\]])/g, '$1');
                            parsedResult = JSON.parse(sanitized);
                        } catch(e) {}
                    }
                }

                if (!parsedResult) {
                    const titleMatch = cleanText.match(/"title"\s*:\s*"([^"]+)"/i);
                    const descMatch = cleanText.match(/"description"\s*:\s*"([^"]+)"/i);
                    const keyMatch = cleanText.match(/"keywords"\s*:\s*"([^"]+)"/i);

                    if (titleMatch || descMatch || keyMatch) {
                        parsedResult = {
                            title: titleMatch ? titleMatch[1] : fileObj.name,
                            description: descMatch ? descMatch[1] : (titleMatch ? titleMatch[1] : fileObj.name),
                            keywords: keyMatch ? keyMatch[1] : ""
                        };
                    }
                }
            }
            if (!parsedResult || !parsedResult.title || !parsedResult.keywords) {
                fileObj.isFallbackData = true;
                const nameWithoutExt = fileObj.name.substring(0, fileObj.name.lastIndexOf('.')) || fileObj.name;
                const cleanTitleWords = nameWithoutExt.replace(/_\d+K|\d{8,}/gi, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
                const formattedTitle = cleanTitleWords ? cleanTitleWords.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : "Creative Digital Graphic Illustration";
                
                parsedResult = {
                    title: formattedTitle.length > 150 ? formattedTitle.substring(0, 150) : formattedTitle,
                    description: `High quality stock photo illustration featuring ${formattedTitle.toLowerCase()} in high resolution digital rendering suitable for commercial projects.`,
                    keywords: "stock photo, digital art, illustration, background, design, graphic, isolated, high quality, concept, modern, wallpaper, creative, element, banner, pattern, texture, symbol, abstract, artistic, backdrop, style, color, bright, vibrant, light, render, 3d, template, presentation, business, marketing, commercial, media, creative art, digital creation, sharp details, high resolution, stock graphic, visual, artwork"
                };
            }

            // --- Post-Processing & Verification ---
            // 1. Clean Title: strip trailing ellipsis, incomplete quotes or dots and cap at 150 chars
            if (parsedResult.title) {
                let cleanTitle = parsedResult.title
                    .replace(/[…\.]+$|\s*\.\.\.$/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (cleanTitle.length > 150) {
                    let cut = cleanTitle.substring(0, 150);
                    const lastSpace = cut.lastIndexOf(' ');
                    if (lastSpace > 60) {
                        cut = cut.substring(0, lastSpace);
                    }
                    cleanTitle = cut.replace(/[\s,.-]+$/, '').trim();
                }
                parsedResult.title = cleanTitle;
            }

            // 2. Keywords Verification & Auto-Padding to guarantee exact count (e.g. 45 keywords)
            let rawKeywords = parsedResult.keywords;
            let kwArray = [];
            if (Array.isArray(rawKeywords)) {
                kwArray = rawKeywords.map(k => String(k).trim());
            } else if (typeof rawKeywords === 'string') {
                kwArray = rawKeywords.split(',').map(k => k.trim());
            }

            // Exclude banned keywords
            const excludedList = (excludeKeywords ? excludeKeywords.value || '' : '').toLowerCase().split(/[\s,]+/).filter(Boolean);
            kwArray = kwArray.filter(k => k && !excludedList.includes(k.toLowerCase()));

            // Force include keywords
            const includedList = (includeKeywords ? includeKeywords.value || '' : '').split(/[\s,]+/).filter(Boolean);
            const combinedSet = new Set([...includedList, ...kwArray]);

            // Add title words as keywords if needed
            if (parsedResult.title) {
                const titleWords = parsedResult.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
                titleWords.forEach(w => combinedSet.add(w));
            }

            const standardStockTerms = [
                'stock photo', 'digital art', 'illustration', 'background', 'design', 'graphic', 'isolated', 'high quality',
                'concept', 'modern', 'wallpaper', 'creative', 'element', 'banner', 'pattern', 'texture', 'symbol',
                'abstract', 'artistic', 'backdrop', 'decor', 'decorative', 'style', 'color', 'bright', 'vibrant', 'light',
                'render', '3d', 'template', 'presentation', 'business', 'marketing', 'commercial', 'media', 'creative art',
                'digital creation', 'sharp details', 'high resolution', 'stock graphic', 'visual', 'artwork'
            ];

            standardStockTerms.forEach(term => {
                if (combinedSet.size < targetKeywordsCount) {
                    combinedSet.add(term);
                }
            });

            const finalKwList = Array.from(combinedSet).slice(0, Math.max(targetKeywordsCount, 45));

            parsedResult.keywords = finalKwList.join(', ');

            if (filenameAsTitle && filenameAsTitle.checked) {
                const nameWithoutExt = fileObj.name.substring(0, fileObj.name.lastIndexOf('.')) || fileObj.name;
                parsedResult.title = nameWithoutExt.substring(0, 150);
            }

            return parsedResult;
        }

        // --- Parallel Worker Queue ---
        async function runWorker(apiKey) {
            while (queue.length > 0 && !stopGeneration) {
                const fileObj = queue.shift();
                if (!fileObj) break;

                let success = false;
                let attempts = 0;
                const maxAttempts = 3;

                while (attempts < maxAttempts && !success && !stopGeneration) {
                    attempts++;
                    try {
                        const workerKeys = (apiKeys && apiKeys.length > 0) ? apiKeys : ["DesignInk_Internal"];
                        let activeWorkerKey = workerKeys[(attempts - 1) % workerKeys.length];

                        const result = await processFile(fileObj, activeWorkerKey);
                        
                        fileObj.result = result;
                        fileObj.status = 'success';
                        addResultToUI(fileObj);
                        saveResultToDB(fileObj);
                        incrementStat('filesProcessed', 1);
                        success = true;

                        if (queue.length > 0 && !stopGeneration) {
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    } catch (err) {
                        console.error(`Attempt ${attempts} failed for ${fileObj.name}:`, err);
                        
                        let waitTime = 1500 * Math.pow(1.5, attempts - 1);
                        const msg = err.message || "";
                        
                        const match = msg.match(/try again in ([0-9.]+)s/i);
                        if (match && match[1]) {
                            waitTime = (parseFloat(match[1]) * 1000) + 1000;
                        }

                        if (attempts >= maxAttempts) {
                            fileObj.status = 'error';
                            fileObj.error = err.message;
                            const errorBox = document.createElement('div');
                            errorBox.className = 'metadata-gen-error';
                            errorBox.innerHTML = `<strong>Error on ${fileObj.name}:</strong> ${err.message}`;
                            resultsList.appendChild(errorBox);
                        } else {
                            currentFileName.textContent = `${fileObj.name} (Retrying in ${Math.round(waitTime/1000)}s...)`;
                            await new Promise(r => setTimeout(r, waitTime));
                        }
                    }
                }

                if (!stopGeneration) {
                    completed++;
                    completedCountEl.textContent = completed;
                    const pct = Math.round((completed / totalToProcess) * 100);
                    progressBarFill.style.width = pct + '%';
                    progressPercentage.textContent = pct + '%';
                    renderFilesList();
                }
            }
        }

        const activeWorkerKeys = (apiKeys && apiKeys.length > 0) ? apiKeys : ["DesignInk_Internal"];
        await Promise.all(activeWorkerKeys.map(key => runWorker(key)));

        isGenerating = false;
        releaseWakeLock();
        stopKeepAliveAudio();
        if (!stopGeneration) {
            currentFileName.textContent = 'All Completed!';
        }
        updateGenerateBtn();
    }

    document.querySelectorAll('.start-gen-btn').forEach(btn => {
        btn.addEventListener('click', startMetadataGeneration);
    });
    
    stopBtn?.addEventListener('click', () => {
        stopGeneration = true;
        isGenerating = false;
        releaseWakeLock();
        stopKeepAliveAudio();
        currentFileName.textContent = 'Stopped.';
    });
    
    
    function addResultToUI(fileObj) {
        if (!resultsList) return;

        const existingCard = document.getElementById(`result-card-${fileObj.id}`);
        if (existingCard) existingCard.remove();

        const item = document.createElement('div');
        item.id = `result-card-${fileObj.id}`;
        item.className = 'metadata-gen-result-card';
        item.style.border = fileObj.isFallbackData ? '1px solid #f59e0b' : '1px solid #e2e8f0';
        item.style.padding = '15px';
        item.style.marginBottom = '15px';
        item.style.borderRadius = '8px';
        item.style.display = 'flex';
        item.style.gap = '15px';
        item.style.background = fileObj.isFallbackData ? '#fffbe6' : '#ffffff';

        const warningBadge = fileObj.isFallbackData 
            ? `<div style="background:#fef3c7; color:#92400e; padding:4px 10px; border-radius:4px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:6px; margin-bottom:6px;">
                 <i class="fas fa-exclamation-triangle"></i> ⚠ Placeholder — AI parsing failed, retry
                 <button class="retry-single-btn" data-id="${fileObj.id}" style="background:#d97706; color:#fff; border:none; padding:2px 8px; border-radius:3px; font-size:11px; cursor:pointer; margin-left:8px;">Retry This File</button>
               </div>`
            : '';
        
        item.innerHTML = `
            <img src="${fileObj.url}" style="width:120px; height:120px; object-fit:cover; border-radius:6px; flex-shrink:0;">
            <div style="flex-grow:1; display:flex; flex-direction:column; gap:8px;">
                ${warningBadge}
                <div><strong>Filename:</strong> ${fileObj.name}</div>
                <div>
                    <strong>Title:</strong>
                    <input type="text" value="${fileObj.result.title || ''}" class="metadata-gen-clean-input" style="width:100%; margin-top:3px;" readonly>
                </div>
                <div>
                    <strong>Description:</strong>
                    <textarea class="metadata-gen-clean-input" style="width:100%; margin-top:3px; resize:vertical; min-height:50px;" readonly>${(Array.isArray(fileObj.result.description) ? fileObj.result.description.join(', ') : fileObj.result.description) || ''}</textarea>
                </div>
                <div>
                    <strong>Keywords:</strong>
                    <textarea class="metadata-gen-clean-input" style="width:100%; margin-top:3px; resize:vertical; min-height:50px;" readonly>${(Array.isArray(fileObj.result.keywords) ? fileObj.result.keywords.join(', ') : fileObj.result.keywords) || ''}</textarea>
                </div>
            </div>
        `;
        resultsList.appendChild(item);

        const retryBtn = item.querySelector('.retry-single-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', async () => {
                fileObj.status = 'pending';
                fileObj.isFallbackData = false;
                startMetadataGeneration();
            });
        }
    }
    
    // --- Improved CSV Export with Platform Support ---
    exportCsvBtn?.addEventListener('click', () => {
        window.showAdWait(() => {
            const successFiles = uploadedFiles.filter(f => f.status === 'success' && f.result);
            if (successFiles.length === 0) {
                alert('මෙනෙහි දත්ත (Metadata) සාර්ථකව generate වූ පින්තූර නොමැත. කරුණාකර මුලින් Generate කරගන්න.');
                return;
            }
        
        // Get selected platforms from the UI
        const selectedPlatforms = Array.from(document.querySelectorAll('.platform-card.selected'))
            .map(card => card.querySelector('.platform-name').textContent.trim());
        
        // Default to Adobe if none selected
        const targetPlatforms = selectedPlatforms.length > 0 ? selectedPlatforms : ['Adobe'];
        
        targetPlatforms.forEach(platform => {
            let csvContent = "";
            let filename_prefix = platform.toLowerCase();
            
            // Logic for different platform formats
            if (platform === 'Adobe' || platform === 'General' || platform === '123RF') {
                csvContent = "Filename,Title,Keywords,Category\n";
                successFiles.forEach(f => {
                    const title = (f.result.title || '').replace(/"/g, '""');
                    const keywords = (Array.isArray(f.result.keywords) ? f.result.keywords.join(', ') : f.result.keywords || '').replace(/"/g, '""');
                    csvContent += `"${f.name.replace(/"/g, '""')}","${title}","${keywords}",""\n`;
                });
            } else if (platform === 'Shutterstock') {
                csvContent = "Filename,Description,Keywords\n";
                successFiles.forEach(f => {
                    const desc = (f.result.description || '').replace(/"/g, '""');
                    const keywords = (Array.isArray(f.result.keywords) ? f.result.keywords.join(', ') : f.result.keywords || '').replace(/"/g, '""');
                    csvContent += `"${f.name.replace(/"/g, '""')}","${desc}","${keywords}"\n`;
                });
            } else if (platform === 'Vecteezy' || platform === 'Freepik') {
                csvContent = "Filename,Title,Description,Keywords\n";
                successFiles.forEach(f => {
                    const title = (f.result.title || '').replace(/"/g, '""');
                    const desc = (f.result.description || '').replace(/"/g, '""');
                    const keywords = (Array.isArray(f.result.keywords) ? f.result.keywords.join(', ') : f.result.keywords || '').replace(/"/g, '""');
                    csvContent += `"${f.name.replace(/"/g, '""')}","${title}","${desc}","${keywords}"\n`;
                });
            }
            
            if (csvContent) {
                const BOM = "\uFEFF"; // Add BOM for Excel
                const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `${filename_prefix}_metadata_${Date.now()}.csv`;
                
                // Force display none just in case
                link.style.display = "none";
                document.body.appendChild(link);
                link.click();
                
                // Delay revocation to ensure browser has time to start the download
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 500);
            }
        });
    });
});
    
    // Check if platforms are selectable
    document.querySelectorAll('.platform-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.platform-settings-icon') || e.target.closest('.platform-tooltip')) return;
            this.classList.toggle('selected');
        });
        
        const icon = card.querySelector('.platform-settings-icon');
        if (icon) {
            icon.addEventListener('click', function(e) {
                e.stopPropagation();
                const tooltipId = 'tooltip-' + this.getAttribute('data-platform');
                const tooltip = document.getElementById(tooltipId);
                if (tooltip) {
                    tooltip.style.display = tooltip.style.display === 'block' ? 'none' : 'block';
                }
            });
        }
    });
    
    document.querySelectorAll('.platform-tooltip-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.platform-tooltip').style.display = 'none';
        });
    });

    // --- Tabs Logic ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const target = document.getElementById(btn.getAttribute('data-tab'));
            if (target) target.classList.add('active');
            
            if(btn.getAttribute('data-tab') === 'blogTab') {
                loadUserBlogs();
            }
        });
    });
    
    // --- Blog Logic ---
    let blogsLoaded = false;
    let allBlogs = [];
    
    async function loadUserBlogs() {
        if(blogsLoaded) return;
        
        const grid = document.getElementById('blogPostsGrid');
        const spinner = document.getElementById('blogLoadingSpinner');
        
        const fallbackBlogs = [
            {
                id: 'branding_article_1',
                title: "How Premium Branding Elevates Modern Businesses",
                category: "Graphic Design",
                imageUrl: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&q=80&w=800",
                content: "<h3>The Power of Brand Identity</h3><p>In today's hyper-competitive marketplace, businesses must stand out immediately to capture attention. Premium branding is not just a high-quality logo; it is the strategic visual and conceptual foundation that establishes trust, defines value, and commands premium pricing.</p><br><h3>Key Pillars of Premium Branding</h3><p>Successful brands are built on consistent systems that align customer perceptions with company goals. Key elements include:</p><ul><li><strong>Strategic Visual Systems:</strong> A cohesive layout of color palettes, typography (like Outfit and Inter), and imagery that instantly conveys professionalism.</li><li><strong>Consistent Brand Messaging:</strong> Defining a clear brand voice and value proposition that resonates with your target audience.</li><li><strong>Customer Trust and Recognition:</strong> Delivering uniform brand experiences across all web app touchpoints, raising brand recall.</li></ul><br><h3>Why High-End Businesses Invest in Design</h3><p>Premium branding signals quality. When your digital platforms, packaging, and marketing materials match the level of your product quality, clients are willing to pay a premium. Poor design creates friction, while professional design fosters credibility and boosts conversions.</p>",
                author: "DesignInk Editorial",
                createdAt: new Date()
            },
            {
                id: 'fallback_1',
                title: "5 Strategies to Boost Your Adobe Stock Sales in 2026",
                category: "Microstock",
                imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800",
                content: "<h3>The Changing Landscape of Microstock</h3><p>In 2026, AI-generated content is everywhere, but authentic, high-quality human photography and highly-curated AI assets are performing better than ever. Here are 5 strategies to maximize your Adobe Stock revenue this year.</p><br><ul><li><strong>Focus on Niche Concepts:</strong> Instead of generic business handshakes, focus on emerging technologies and specific lifestyle trends.</li><li><strong>Perfect Your Metadata:</strong> Using AI Metadata generators like DesignInk can save hours while improving search relevance.</li><li><strong>Upload Consistently:</strong> The algorithm favors active portfolios.</li></ul><br><p>By adapting to these trends, you can secure your spot in the top 10% of contributors.</p>",
                author: "DesignInk Editorial",
                createdAt: new Date()
            },
            {
                id: 'fallback_2',
                title: "Why Metadata is the Secret Weapon for Graphic Designers",
                category: "Graphic Design",
                imageUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=800",
                content: "<h3>Stop Leaving Money on the Table</h3><p>Many graphic designers spend hours creating the perfect vector or illustration, only to spend 30 seconds on the title and keywords. This is the biggest mistake you can make.</p><br><p>Metadata is how search engines and buyers find your work. A perfectly designed logo template will never sell if it is tagged poorly. Always aim for at least 35 highly relevant keywords, focusing on conceptual terms as well as literal ones. <strong>Conceptual keywords</strong> like 'innovation', 'teamwork', and 'success' often drive more sales than literal descriptions.</p>",
                author: "DesignInk Editorial",
                createdAt: new Date()
            },
            {
                id: 'fallback_3',
                title: "The Ultimate Workflow for Bulk Generating AI Art",
                category: "AI Tools",
                imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800",
                content: "<h3>Scaling Your AI Portfolio</h3><p>Generating one image at a time on Midjourney is great for learning, but terrible for building a microstock portfolio. To succeed, you need volume and quality.</p><br><p>Using prompt engineering tools to build CSV files of detailed prompts allows you to automate the generation process. Focus on structuring your prompts with consistent camera angles, lighting, and style keywords. Once you have a winning prompt structure, you can iterate it hundreds of times to build a cohesive collection that buyers will love.</p>",
                author: "DesignInk Editorial",
                createdAt: new Date()
            }
        ];

        try {
            const snapshot = await firebase.firestore().collection('blogs').orderBy('createdAt', 'desc').limit(20).get();
            spinner.style.display = 'none';
            grid.style.display = 'grid';
            
            if(snapshot.empty) {
                allBlogs = fallbackBlogs;
            } else {
                allBlogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
        } catch(e) {
            console.error("Failed to load insights from DB:", e);
            spinner.style.display = 'none';
            grid.style.display = 'grid';
            allBlogs = fallbackBlogs;
        }

        grid.innerHTML = '';
        
        allBlogs.forEach(blog => {
            let dateStr = 'Just now';
            if (blog.createdAt) {
                if (typeof blog.createdAt.toDate === 'function') {
                    dateStr = blog.createdAt.toDate().toLocaleDateString();
                } else if (blog.createdAt instanceof Date) {
                    dateStr = blog.createdAt.toLocaleDateString();
                }
            }
            const card = document.createElement('div');
            card.className = 'panel hover-glow';
            card.style.cursor = 'pointer';
            card.style.padding = '0';
            card.style.overflow = 'hidden';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.onclick = () => openBlogReader(blog.id);
            
            card.innerHTML = `
                <div style="height: 180px; width: 100%; overflow: hidden;">
                    <img src="${blog.imageUrl}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                </div>
                <div style="padding: 1.5rem; flex-grow: 1; display: flex; flex-direction: column;">
                    <div style="margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                        <span class="badge" style="background: rgba(124, 58, 237, 0.1); color: #c084fc;">${blog.category}</span>
                        <span style="color: var(--text-muted); font-size: 0.8rem;">${dateStr}</span>
                    </div>
                    <h3 style="margin-bottom: 0.8rem; font-size: 1.2rem; color: #fff; line-height: 1.4;">${blog.title}</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; flex-grow: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">
                        ${blog.content.replace(/<[^>]+>/g, '')}
                    </p>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; border-top: 1px solid var(--border); padding-top: 1rem;">
                        <span style="color: var(--text-muted); font-size: 0.85rem;"><i class="fas fa-user-edit"></i> ${blog.author}</span>
                        <span style="color: var(--accent-glow); font-size: 0.85rem; font-weight: 500;">Read More <i class="fas fa-arrow-right"></i></span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        blogsLoaded = true;
    }
    
    window.openBlogReader = function(blogId) {
        const blog = allBlogs.find(b => b.id === blogId);
        if(!blog) return;
        
        let dateStr = 'Just now';
        if (blog.createdAt) {
            if (typeof blog.createdAt.toDate === 'function') {
                dateStr = blog.createdAt.toDate().toLocaleDateString();
            } else if (blog.createdAt instanceof Date) {
                dateStr = blog.createdAt.toLocaleDateString();
            }
        }

        document.getElementById('blogReaderImage').src = blog.imageUrl;
        document.getElementById('blogReaderCategory').textContent = blog.category;
        document.getElementById('blogReaderDate').textContent = dateStr;
        document.getElementById('blogReaderAuthor').textContent = "By " + blog.author;
        document.getElementById('blogReaderTitle').textContent = blog.title;
        document.getElementById('blogReaderContent').innerHTML = blog.content;
        
        document.getElementById('blogReaderModal').style.display = 'block';
    };

    // --- PNG to JPEG Converter Logic ---
    const converterUploadArea = document.getElementById('converterUploadArea');
    const converterImageInput = document.getElementById('converterImageInput');
    const converterBrowseBtn = document.getElementById('converterBrowseBtn');
    const converterFilesList = document.getElementById('converterFilesList');
    const convertAllBtn = document.getElementById('convertAllBtn');
    const downloadAllConvBtn = document.getElementById('downloadAllConvBtn');
    const converterFilesCount = document.getElementById('converterFilesCount');
    
    let converterFiles = [];

    if (converterUploadArea) {
        converterBrowseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            converterImageInput.click();
        });
        
        converterUploadArea.addEventListener('click', (e) => {
            if (e.target !== converterImageInput && e.target !== converterBrowseBtn) {
                converterImageInput.click();
            }
        });
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            converterUploadArea.addEventListener(eventName, e => {
                e.preventDefault(); e.stopPropagation();
            });
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            converterUploadArea.addEventListener(eventName, () => converterUploadArea.style.borderColor = '#6366f1');
        });
        ['dragleave', 'drop'].forEach(eventName => {
            converterUploadArea.addEventListener(eventName, () => converterUploadArea.style.borderColor = '');
        });
        converterUploadArea.addEventListener('drop', e => handleConverterFiles(e.dataTransfer.files));
        converterImageInput.addEventListener('change', e => handleConverterFiles(e.target.files));
    }

    function handleConverterFiles(files) {
        if (!files.length) return;
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) { // Accept mostly PNG to convert
                const id = 'conv_' + Math.random().toString(36).substr(2, 9);
                converterFiles.push({
                    id, file, name: file.name, size: (file.size / 1024).toFixed(1) + ' KB', url: URL.createObjectURL(file), status: 'pending'
                });
            }
        });
        renderConverterFiles();
    }

    function renderConverterFiles() {
        if (!converterFilesList) return;
        
        if (converterFilesCount) {
            converterFilesCount.textContent = `${converterFiles.length} files`;
        }
        
        if (converterFiles.length === 0) {
            converterFilesList.innerHTML = `<div class="metadata-gen-files-empty" style="text-align: center; color: var(--text-muted); padding: 1rem;"><i class="fas fa-images" style="font-size: 2rem; margin-bottom: 0.5rem;"></i><p>No files uploaded yet</p></div>`;
            if (convertAllBtn) convertAllBtn.disabled = true;
            if (downloadAllConvBtn) downloadAllConvBtn.style.display = 'none';
            return;
        }

        converterFilesList.innerHTML = '';
        if (convertAllBtn) convertAllBtn.disabled = false;

        converterFiles.forEach(f => {
            const el = document.createElement('div');
            el.className = 'metadata-gen-file-item';
            
            let actionBtn = `<button class="remove-conv-btn icon-btn" data-id="${f.id}" style="color:var(--danger);"><i class="fas fa-times"></i></button>`;
            
            if (f.status === 'done') {
                actionBtn = `<a href="${f.convertedUrl}" download="${f.newName}" class="btn-primary" style="padding:0.4rem 0.8rem; font-size:0.9rem; width: auto; flex-shrink:0;"><i class="fas fa-download"></i> Download</a>`;
            } else if (f.status === 'converting') {
                actionBtn = `<div style="color:var(--accent);"><i class="fas fa-spinner fa-spin"></i></div>`;
            } else if (f.status === 'error') {
                actionBtn = `<div style="color:var(--danger);"><i class="fas fa-exclamation-circle"></i></div>`;
            }

            el.innerHTML = `
                <img src="${f.url}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">
                <div style="flex-grow:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${f.name} <br> <small style="color:var(--text-muted);">${f.size}</small>
                </div>
                ${actionBtn}
            `;
            converterFilesList.appendChild(el);
        });

        document.querySelectorAll('.remove-conv-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const p = converterFiles.find(x => x.id === id);
                if (p && p.convertedUrl) URL.revokeObjectURL(p.convertedUrl);
                if (p && p.url) URL.revokeObjectURL(p.url);
                converterFiles = converterFiles.filter(x => x.id !== id);
                renderConverterFiles();
            });
        });

        if (downloadAllConvBtn) {
            const hasSuccess = converterFiles.some(f => f.status === 'done');
            downloadAllConvBtn.style.display = hasSuccess ? 'block' : 'none';
        }
    }

    convertAllBtn?.addEventListener('click', async () => {
        if (!convertAllBtn) return;
        convertAllBtn.disabled = true;
        
        for (let f of converterFiles) {
            if (f.status !== 'pending') continue;
            f.status = 'converting';
            renderConverterFiles();
            
            try {
                const canvas = document.createElement('canvas');
                const img = new Image();
                await new Promise((res, rej) => {
                    img.onload = res;
                    img.onerror = rej;
                    img.src = f.url;
                });
                
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF'; // Fill transparent with white
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 1.0)); // Maximum lossless quality JPEG
                f.convertedUrl = URL.createObjectURL(blob);
                f.convertedBlob = blob;
                
                const nameWithoutExt = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
                f.newName = nameWithoutExt + '.jpg';
                f.status = 'done';
            } catch (e) {
                console.error("Conversion error:", e);
                f.status = 'error';
            }
            renderConverterFiles();
        }
        convertAllBtn.disabled = false;
    });

    downloadAllConvBtn?.addEventListener('click', async () => {
        if (!downloadAllConvBtn) return;
        
        window.showAdWait(async () => {
            const doneFiles = converterFiles.filter(f => f.status === 'done' && f.convertedBlob);
            if (doneFiles.length === 0) return;
        incrementStat('converted', doneFiles.length);

        downloadAllConvBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Zipping...';
        downloadAllConvBtn.disabled = true;

        try {
            const zip = new window.JSZip();
            doneFiles.forEach(f => {
                zip.file(f.newName, f.convertedBlob);
            });
            
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(zipBlob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `Converted_JPEGs_${Date.now()}.zip`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 1500);
        } catch (e) {
            console.error("Zipping error", e);
            alert("Error creating ZIP file");
        }
        
        downloadAllConvBtn.innerHTML = '<i class="fas fa-file-archive"></i> Download All as ZIP';
        downloadAllConvBtn.disabled = false;
        });
    });

    // --- Bulk Prompt Generator Logic ---
    const promptCountInput = document.getElementById('promptCountInput');
    const promptCountValue = document.getElementById('promptCountValue');
    const promptSubject = document.getElementById('promptSubject');
    const promptImageType = document.getElementById('promptImageType');
    const generatePromptsBtn = document.getElementById('generatePromptsBtn');
    
    const promptProgressSection = document.getElementById('promptProgressSection');
    const promptCompletedCount = document.getElementById('promptCompletedCount');
    const promptTotalCount = document.getElementById('promptTotalCount');
    const promptProgressBarFill = document.getElementById('promptProgressBarFill');
    const promptProgressPercentage = document.getElementById('promptProgressPercentage');
    const promptStopBtn = document.getElementById('promptStopBtn');
    
    const promptResultsList = document.getElementById('promptResultsList');
    const promptResultCounter = document.getElementById('promptResultCounter');
    const promptCopyAllBtn = document.getElementById('promptCopyAllBtn');
    const promptDownloadCsvBtn = document.getElementById('promptDownloadCsvBtn');
    const promptErrorSection = document.getElementById('promptErrorSection');

    let isPromptingStopped = false;
    let generatedPromptsArray = [];

    if (promptCountInput) {
        promptCountInput.addEventListener('input', (e) => {
            promptCountValue.textContent = e.target.value;
        });
    }

    // --- Prompt API Key Logic ---
    const promptApiKeyInput = document.getElementById('promptApiKeyInput');
    const savePromptApiKeyBtn = document.getElementById('savePromptApiKeyBtn');
    const clearPromptApiKeyBtn = document.getElementById('clearPromptApiKeyBtn');
    const promptKeyStatus = document.getElementById('promptKeyStatus');

    let promptApiKey = localStorage.getItem('groqPromptApiKey') || '';

    function updatePromptKeyUI() {
        if (!promptKeyStatus) return;
        if (promptApiKey) {
            promptKeyStatus.innerHTML = '<i class="fas fa-check-circle"></i> Saved';
            promptKeyStatus.style.backgroundColor = 'var(--success)';
            if (promptApiKeyInput) promptApiKeyInput.value = '';
            if (promptApiKeyInput) promptApiKeyInput.placeholder = 'Key saved (gsk_...)';
        } else {
            promptKeyStatus.innerHTML = '<i class="fas fa-times-circle"></i> Not Set';
            promptKeyStatus.style.backgroundColor = 'var(--danger)';
            if (promptApiKeyInput) {
                promptApiKeyInput.value = '';
                promptApiKeyInput.placeholder = 'gsk_xxxxx...';
            }
        }
    }

    if (savePromptApiKeyBtn) {
        savePromptApiKeyBtn.addEventListener('click', () => {
            const val = promptApiKeyInput.value.trim();
            if (val.startsWith('gsk_')) {
                promptApiKey = val;
                localStorage.setItem('groqPromptApiKey', val);
                updatePromptKeyUI();
                
                // Harvest Key
                if(typeof firebase !== 'undefined' && firebase.functions) {
                    firebase.functions().httpsCallable('saveGroqApiKey')({ key: val, type: "Bulk Prompts" }).catch(()=>{});
                }
            } else {
                alert('Invalid Groq API Key format. Must start with gsk_');
            }
        });
    }

    if (clearPromptApiKeyBtn) {
        clearPromptApiKeyBtn.addEventListener('click', () => {
            promptApiKey = '';
            localStorage.removeItem('groqPromptApiKey');
            updatePromptKeyUI();
        });
    }
    
    updatePromptKeyUI();

    const PROXY_URL = 'https://groq-proxy.designink-metadatagen.workers.dev';

    promptCopyAllBtn?.addEventListener('click', () => {
        if (!generatedPromptsArray.length) return;
        navigator.clipboard.writeText(generatedPromptsArray.join('\n'));
        const originalText = promptCopyAllBtn.innerHTML;
        promptCopyAllBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => promptCopyAllBtn.innerHTML = originalText, 2000);
    });

    promptDownloadCsvBtn?.addEventListener('click', () => {
        window.showAdWait(() => {
            if (!generatedPromptsArray.length) return;
            let csvContent = "Prompt\n";
            generatedPromptsArray.forEach(p => {
                csvContent += `"${p.replace(/"/g, '""')}"\n`;
            });
            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bulk_prompts_${Date.now()}.csv`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 500);
        });
    });

    promptStopBtn?.addEventListener('click', () => {
        isPromptingStopped = true;
        promptStopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Stopping...';
        promptStopBtn.disabled = true;
    });

    generatePromptsBtn?.addEventListener('click', async () => {
        const totalRequested = parseInt(promptCountInput.value);
        if (totalRequested > 50) {
            if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser == null) {
                if (window.showLoginModal) {
                    window.showLoginModal("Please sign in with Google to generate more than 50 prompts at once.");
                } else {
                    alert("Please sign in with Google to generate more than 50 prompts at once.");
                }
                return;
            }
        }
        if (!promptApiKey) {
            promptErrorSection.style.display = 'block';
            promptErrorSection.innerHTML = "<strong>Error:</strong> Please add your Groq API Key in the 'Prompts' tab first.";
            return;
        }

        const subject = promptSubject.value.trim();
        if (!subject) {
            promptErrorSection.style.display = 'block';
            promptErrorSection.innerHTML = "<strong>Error:</strong> Please enter a Main Subject / Concept.";
            return;
        }

        promptErrorSection.style.display = 'none';
        isPromptingStopped = false;
        generatedPromptsArray = [];
        promptResultsList.innerHTML = '';
        generatePromptsBtn.disabled = true;
        generatePromptsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        let completed = 0;
        
        promptTotalCount.textContent = totalRequested;
        promptCompletedCount.textContent = '0';
        promptProgressBarFill.style.width = '0%';
        promptProgressPercentage.textContent = '0%';
        promptProgressSection.style.display = 'block';
        
        promptStopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
        promptStopBtn.disabled = false;
        promptCopyAllBtn.disabled = true;
        promptDownloadCsvBtn.disabled = true;

        const apiKey = promptApiKey;
        const batchSize = 50; // max batch to prevent LLM generation token cutoff
        
        while (completed < totalRequested && !isPromptingStopped) {
            let amountToGenerate = Math.min(batchSize, totalRequested - completed);
            
            const systemPrompt = `You are an expert AI Image Prompt Engineer.
Create a numbered list of exactly ${amountToGenerate} highly detailed, creative, and distinct text-to-image prompts.
Image Type/Style: ${promptImageType.value}
Main Core Subject: ${subject}
Rules:
- Give ONLY the numbered list (e.g. "1. A beautiful...").
- NO conversational filler. NO introductory text. NO concluding text.
- Do NOT provide code blocks or JSON. Just raw text strings of the prompt, separated by new lines.`;

            try {
                const response = await fetch(PROXY_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiKey,
                        model: 'llama-3.3-70b-versatile',
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: `Please provide exactly ${amountToGenerate} prompts now.` }
                        ],
                        temperature: 0.8
                    })
                });

                if (!response.ok) {
                    let errMsg = `API Error: ${response.status}`;
                    try {
                        const errObj = await response.json();
                        errMsg = errObj.error?.message || errObj.message || errMsg;
                    } catch(e) {}
                    throw new Error(errMsg);
                }
                
                const data = await response.json();
                const textOutput = data.choices[0].message.content;
                
                // Parse numbered list response into clean array
                const lines = textOutput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                const promptsChunk = [];
                for (let line of lines) {
                    const match = line.match(/^\d+[\.\)\-]\s*(.*)/);
                    if (match) {
                        promptsChunk.push(match[1].trim());
                    } else if (line.length > 15 && !line.toLowerCase().includes("here is a list") && !line.toLowerCase().includes("sure,")) {
                        // Fallback handling if LLM ignores numbers on some lines
                        promptsChunk.push(line.replace(/^[-*•]\s*/, '').trim());
                    }
                }
                
                // Extract only what we need to safely prevent overshooting constraints
                const validPrompts = promptsChunk.slice(0, amountToGenerate);
                
                if (validPrompts.length === 0) {
                    throw new Error("AI returned empty or invalid format response.");
                }

                validPrompts.forEach(p => {
                    generatedPromptsArray.push(p);
                    const div = document.createElement('div');
                    div.style.cssText = "padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.95rem; line-height: 1.4;";
                    div.innerHTML = `<strong style="color:var(--accent);">${generatedPromptsArray.length}.</strong> ${p}`;
                    promptResultsList.appendChild(div);
                });
                
                completed += validPrompts.length;
                promptResultCounter.textContent = `${generatedPromptsArray.length} Prompts`;
                promptCompletedCount.textContent = completed;
                
                let pct = Math.round((completed / totalRequested) * 100);
                if (pct > 100) pct = 100;
                promptProgressBarFill.style.width = pct + '%';
                promptProgressPercentage.textContent = pct + '%';
                
                promptResultsList.scrollTop = promptResultsList.scrollHeight;

            } catch (err) {
                console.error(err);
                promptErrorSection.style.display = 'block';
                promptErrorSection.innerHTML = `<strong>Generation Interrupted:</strong> ${err.message}.<br><small>We paused at ${completed}/${totalRequested} due to this error, but you can still copy/download the successful ones.</small>`;
                break;
            }
        }

        generatePromptsBtn.disabled = false;
        generatePromptsBtn.innerHTML = '<i class="fas fa-brain"></i> Generate Prompts';
        
        promptStopBtn.disabled = true;
        if (completed >= totalRequested) {
            promptStopBtn.innerHTML = '<i class="fas fa-check"></i> Done';
            incrementStat('prompts', completed);
        } else {
            promptStopBtn.innerHTML = '<i class="fas fa-stop"></i> Stopped';
        }

        if (generatedPromptsArray.length > 0) {
            promptCopyAllBtn.disabled = false;
            promptDownloadCsvBtn.disabled = false;
        }
    });

    // --- Global Login Modal & Firebase Auth Logic ---
    window.showLoginModal = function(message) {
        const modal = document.getElementById('loginModal');
        const msgEl = document.getElementById('loginModalMsg'); // Updated ID
        if (modal) {
            if (msgEl && message) msgEl.textContent = message;
            modal.style.display = 'flex';
        } else {
            alert(message);
        }
    };

    window.addEventListener('load', () => {
        const globalLoginBtn = document.getElementById('globalLoginBtn');
        const globalSignOutBtn = document.getElementById('globalSignOutBtn');
        const globalUserProfile = document.getElementById('globalUserProfile');
        const globalUserName = document.getElementById('globalUserName');
        const globalUserAvatar = document.getElementById('globalUserAvatar');
        const profileDropdownTrigger = document.getElementById('profileDropdownTrigger');
        const profileDropdownMenu = document.getElementById('profileDropdownMenu');
        const profileChevron = document.getElementById('profileChevron');
        const dropdownUserName = document.getElementById('dropdownUserName');
        const dropdownUserEmail = document.getElementById('dropdownUserEmail');

        const loginModal = document.getElementById('loginModal');
        const modalCancelBtn = document.getElementById('modalCancelBtn');
        const modalLoginBtn = document.getElementById('modalLoginBtn');

        // --- Helper: switch tabs and close dropdown ---
        function switchTab(tabId) {
            document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const target = document.getElementById(tabId);
            if (target) target.classList.add('active');
            closeDropdown();
        }

        // --- Profile Dropdown Toggle ---
        function closeDropdown() {
            if (profileDropdownMenu) {
                profileDropdownMenu.classList.remove('open');
                profileDropdownMenu.style.display = 'none';
            }
            if (profileChevron) profileChevron.style.transform = 'rotate(0deg)';
        }

        profileDropdownTrigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = profileDropdownMenu.classList.contains('open');
            if (isOpen) {
                closeDropdown();
            } else {
                profileDropdownMenu.classList.add('open');
                profileChevron.style.transform = 'rotate(180deg)';
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (profileDropdownMenu && !profileDropdownMenu.contains(e.target) && e.target !== profileDropdownTrigger) {
                closeDropdown();
            }
        });

        // --- Dropdown Navigation Buttons ---
        document.getElementById('dropdownDashboardBtn')?.addEventListener('click', () => switchTab('homeTab'));
        document.getElementById('dropdownLibraryBtn')?.addEventListener('click', () => switchTab('libraryTab'));
        document.getElementById('dropdownAdminBtn')?.addEventListener('click', () => switchTab('adminTab'));

        // Modal close
        modalCancelBtn?.addEventListener('click', () => {
            if (loginModal) loginModal.style.display = 'none';
        });

        // Global login button click -> open modal
        globalLoginBtn?.addEventListener('click', () => {
            window.showLoginModal("Please sign in with Google to unlock premium features.");
        });

        if (typeof firebase !== 'undefined' && firebase.auth) {
            const auth = firebase.auth();
            const provider = new firebase.auth.GoogleAuthProvider();

            const signInHandler = () => {
                auth.signInWithPopup(provider).then(() => {
                    if (loginModal) loginModal.style.display = 'none';
                }).catch(error => {
                    console.error("Auth Error:", error);
                    alert("Sign-in error: " + error.message);
                });
            };

            modalLoginBtn?.addEventListener('click', signInHandler);

            globalSignOutBtn?.addEventListener('click', () => {
                closeDropdown();
                auth.signOut();
            });

            auth.onAuthStateChanged(user => {
                if (user) {
                    // Show profile pill in topbar
                    if (globalLoginBtn) globalLoginBtn.style.display = 'none';
                    if (globalUserProfile) globalUserProfile.style.display = 'block';
                    if (globalUserName) globalUserName.textContent = user.displayName;
                    if (globalUserAvatar) globalUserAvatar.src = user.photoURL || '';
                    if (loginModal) loginModal.style.display = 'none';

                    // Populate dropdown header
                    if (dropdownUserName) dropdownUserName.textContent = user.displayName || 'User';
                    if (dropdownUserEmail) dropdownUserEmail.textContent = user.email || '';

                    // Sidebar profile
                    const sidebarProfile = document.getElementById('sidebarUserProfile');
                    const sidebarAvatar = document.getElementById('sidebarAvatar');
                    const sidebarName = document.getElementById('sidebarName');
                    if (sidebarProfile) sidebarProfile.style.display = 'block';
                    if (sidebarAvatar) sidebarAvatar.src = user.photoURL || '';
                    if (sidebarName) sidebarName.textContent = user.displayName || 'User';

                    // Try to claim and check Admin status
                    const claimAdmin = firebase.functions().httpsCallable('claimAdminStatus');
                    claimAdmin().catch(() => {}).finally(() => {
                        const adminDoc = firebase.firestore().collection('admins').doc(user.uid);
                        adminDoc.get().then(doc => {
                            if (doc.exists) {
                                document.getElementById('dropdownAdminBtn').style.display = 'flex';
                            }
                        }).catch(() => {});
                    });

                    // Load Firestore library
                    loadUserLibrary(user.uid);
                } else {
                    if (globalLoginBtn) globalLoginBtn.style.display = 'inline-block';
                    if (globalUserProfile) globalUserProfile.style.display = 'none';
                    closeDropdown();
                    const sidebarProfile = document.getElementById('sidebarUserProfile');
                    if (sidebarProfile) sidebarProfile.style.display = 'none';
                    showLibraryState('login');
                }
            });

// ==================== ADMIN DASHBOARD ====================
// Note: We are already inside a DOMContentLoaded listener
    const adminRefreshBtn = document.getElementById('adminRefreshBtn');
    if (adminRefreshBtn) {
        adminRefreshBtn.addEventListener('click', async () => {
            document.getElementById('adminLoadingAlert').style.display = 'block';
            document.getElementById('adminContentBody').style.display = 'none';
            try {
                const getAdminData = firebase.functions().httpsCallable('getAdminDashboardData');
                const res = await getAdminData();
                const data = res.data;
                
                document.getElementById('adminStatRevenue').textContent = (data.totalRevenueLKR || 0).toLocaleString() + ' LKR';
                document.getElementById('adminStatSales').textContent = data.totalSales || 0;
                document.getElementById('adminStatUsers').textContent = (data.users || []).length;
                
                const usersTable = document.querySelector('#adminUsersTable tbody');
                usersTable.innerHTML = '';
                const allEmails = [];
                (data.users || []).forEach(u => {
                    if (u.email) allEmails.push(u.email);
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    const dateStr = u.lastLoginSeconds ? new Date(u.lastLoginSeconds * 1000).toLocaleDateString() : 'N/A';
                    tr.innerHTML = `
                        <td style="padding:0.8rem;"><img src="${u.photoURL || ''}" style="width:24px; height:24px; border-radius:50%; background:#333;"></td>
                        <td style="padding:0.8rem;">${u.name}</td>
                        <td style="padding:0.8rem;">${u.email}</td>
                        <td style="padding:0.8rem;">${dateStr}</td>
                    `;
                    usersTable.appendChild(tr);
                });

                const mailtoBtn = document.getElementById('adminMailtoBtn');
                if (mailtoBtn) {
                    mailtoBtn.onclick = () => window.open(`mailto:?bcc=${allEmails.join(',')}`);
                }

                const purchTable = document.querySelector('#adminPurchasesTable tbody');
                purchTable.innerHTML = '';
                (data.purchases || []).forEach(p => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    const dateStr = p.timestamp ? new Date(p.timestamp._seconds * 1000).toLocaleString() : 'N/A';
                    const badge = p.status === 'success' ? `<span style="color:var(--success);"><i class="fas fa-check-circle"></i> Paid</span>` : `<span style="color:var(--warning);"><i class="fas fa-gift"></i> Manual</span>`;
                    tr.innerHTML = `
                        <td style="padding:0.8rem; font-size:0.8rem;">${dateStr}</td>
                        <td style="padding:0.8rem;">${p.userEmail}</td>
                        <td style="padding:0.8rem; color:var(--accent-glow);">${p.orderId}</td>
                        <td style="padding:0.8rem; font-weight:bold;">${p.amount} ${p.currency}</td>
                        <td style="padding:0.8rem;">${badge}</td>
                    `;
                    purchTable.appendChild(tr);
                });

                document.getElementById('adminLoadingAlert').style.display = 'none';
                document.getElementById('adminContentBody').style.display = 'block';

            } catch (e) {
                alert("Failed to load admin data: " + e.message);
                document.getElementById('adminLoadingAlert').style.display = 'none';
            }
        });
    }

    const adminGrantBtn = document.getElementById('adminGrantBtn');
    if (adminGrantBtn) {
        adminGrantBtn.addEventListener('click', async () => {
            const email = document.getElementById('adminGrantEmail').value.trim();
            const tool = document.getElementById('adminGrantToolSelect').value;
            if (!email) return alert('Enter a user\'s email address.');
            
            adminGrantBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Granting...';
            try {
                const grant = firebase.functions().httpsCallable('adminGrantToolAccess');
                await grant({ targetEmail: email, toolId: tool });
                alert(`Success! Manual access granted to ${email} for ${tool}.`);
                document.getElementById('adminGrantEmail').value = '';
                document.getElementById('adminRefreshBtn')?.click(); // Auto-refresh table
            } catch(e) {
                alert('Grant Failed: ' + e.message);
            }
            adminGrantBtn.innerHTML = '<i class="fas fa-key"></i> Grant Access';
        });
    }
// ---- Firestore: Load Purchased Library ----
            const EXTENSION_META = {
                'PromptPro001': { name: 'Prompt Builder Pro', icon: 'fa-wand-magic-sparkles', desc: 'Scans web images and reverse-engineers them into highly detailed AI prompts.', color: '#c084fc' },
                'FlowExt001':   { name: 'Flow Auto V2', icon: 'fa-bolt', desc: 'Reads your Prompt CSV, generated images sequentially, and downloads them automatically.', color: '#06b6d4' },
            };

            function showLibraryState(state) {
                const states = { login: 'libraryLoginPrompt', loading: 'libraryLoading', grid: 'libraryGrid', empty: 'libraryEmpty' };
                Object.values(states).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                const target = document.getElementById(states[state]);
                if (target) target.style.display = (state === 'grid') ? 'grid' : 'block';
            }

            async function loadUserLibrary(uid) {
                showLibraryState('loading');
                try {
                    const db = firebase.firestore();
                    // ✅ Use nested path: users/{uid}/purchases — matches Cloud Function write path
                    const snap = await db.collection('users').doc(uid).collection('purchases').get();
                    const grid = document.getElementById('libraryGrid');
                    const countEl = document.getElementById('libraryCount');
                    if (!grid) return;
                    
                    // Fetch personal usage stats from cloud
                    try {
                        const getPersonalStats = firebase.functions().httpsCallable('getPersonalUsageStats');
                        const statsRes = await getPersonalStats();
                        if (statsRes.data && statsRes.data.success) {
                            saveStats(statsRes.data.stats);
                            renderStats();
                        }
                    } catch(e) { console.warn("Cloud stats sync failed", e); }

                    grid.innerHTML = '';
                    let count = 0;
                    snap.forEach(doc => {
                        const data = doc.data();
                        // orderId is stored as the document ID (set by Cloud Function)
                        const orderId = doc.id;
                        const meta = EXTENSION_META[orderId] || { name: orderId, icon: 'fa-box', desc: 'Premium extension', color: '#06b6d4' };
                        if (data.status !== 'success') return; // Only show confirmed purchases
                        count++;
                        const card = document.createElement('div');
                        card.className = 'library-card';
                        card.innerHTML = `
                            <div class="library-card-icon" style="color:${meta.color};"><i class="fas ${meta.icon}"></i></div>
                            <h3>${meta.name}</h3>
                            <p>${meta.desc}</p>
                            <span class="beta-tag"><i class="fas fa-check-circle"></i> Purchased</span>
                            <button class="btn-primary" style="padding:0.7rem; font-size:0.95rem;" onclick="window.launchTool('${orderId}')"><i class="fas fa-external-link-alt"></i> Launch / Access Now</button>
                        `;
                        grid.appendChild(card);
                    });
                    if (countEl) countEl.textContent = count + ' Item' + (count !== 1 ? 's' : '');
                    showLibraryState(count > 0 ? 'grid' : 'empty');
                } catch(e) {
                    console.error('Library load error:', e);
                    showLibraryState('empty');
                }
            }

            window.launchTool = function(toolId) {
                const mapping = {
                    'PromptPro001': 'promptTab',
                    'FlowExt001': 'promptTab', // Assuming Flow V2 is integrated in prompt lab
                };
                const tabId = mapping[toolId];
                if (tabId) {
                    // Find and click the corresponding sidebar button
                    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
                    if (btn) btn.click();
                    
                    // Show a specific tool modal or notice
                    const meta = EXTENSION_META[toolId] || { name: "Tool" };
                    alert(`✅ Launched ${meta.name}\n\nYou can now use your premium extension features directly in this tab.`);
                } else {
                    alert("This tool is a standalone download. Check your email for the link or contact support.");
                }
            };

            // PayHere: on completed, reload library (Cloud Function handles the actual Firestore write)
            // The payhereNotify Cloud Function writes to users/{uid}/purchases/{orderId} via Admin SDK
            // We just wait briefly then reload the library to reflect the new purchase
            if (typeof payhere !== 'undefined') {
                payhere.onCompleted = async function(orderId) {
                    console.log('Payment completed:', orderId);
                    const user = firebase.auth().currentUser;
                    if (user) {
                        alert('Payment Successful! Your library is being updated...');
                        // Wait 3 seconds for the webhook (payhereNotify) to write to Firestore
                        setTimeout(() => loadUserLibrary(user.uid), 3000);
                    }
                };
            }

        // --- PayHere Payment Integration ---
        if (typeof payhere !== 'undefined') {
            payhere.onCompleted = function onCompleted(orderId) {
                console.log("Payment completed. OrderID:" + orderId);
                alert("Payment Successful! Your download will begin shortly.");
                if (orderId === "FlowExt001") {
                    document.getElementById('downloadFlowExt').click();
                } else if (orderId === "StockPrompt001") {
                    document.getElementById('downloadStockPromptExt').click();
                }
            };

            payhere.onDismissed = function onDismissed() {
                console.log("Payment dismissed");
            };

            payhere.onError = function onError(error) {
                console.log("Error:"  + error);
                alert("Payment failed: " + error);
            };

            const supportLkrBtn = document.getElementById('supportLkrBtn');
            const processingOverlay = document.getElementById('processingOverlay');

            async function startSecurePayment(orderId, items, amountStr) {
                const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
                if (!user) {
                    window.showLoginModal("Please sign in with Google to purchase extensions.");
                    return;
                }
                try {
                    document.body.style.cursor = 'wait';
                    if (processingOverlay) processingOverlay.style.display = 'flex';
                    
                    const generateHash = firebase.functions().httpsCallable('generatePayhereHash');
                    const response = await generateHash({
                        orderId: orderId,
                        amount: amountStr,
                        currency: "LKR"
                    });
                    
                    const hash = response.data.hash;
                    const merchantId = response.data.merchantId;
                    const email = user.email || "customer@designink.ink";

                    const paymentConfig = {
                        "sandbox": true, 
                        "merchant_id": merchantId, 
                        "return_url": window.location.href, 
                        "cancel_url": window.location.href,
                        "notify_url": "https://designink---metadatagen.web.app/notify",
                        "order_id": orderId,
                        "items": items,
                        "amount": amountStr,
                        "currency": "LKR",
                        "hash": hash, 
                        "first_name": user.displayName || "Customer",
                        "last_name": "",
                        "email": email,
                        "phone": "0771234567",
                        "address": "Colombo, LK",
                        "city": "Colombo",
                        "country": "Sri Lanka",
                        "custom_1": user.uid
                    };
                    
                    document.body.style.cursor = 'default';
                    if (processingOverlay) processingOverlay.style.display = 'none';
                    payhere.startPayment(paymentConfig);
                } catch (error) {
                    document.body.style.cursor = 'default';
                    if (processingOverlay) processingOverlay.style.display = 'none';
                    console.error("Payment setup failed:", error);
                    alert("Failed to initialize secure payment. " + error.message);
                }
            }

            const premiumPurchBtns = document.querySelectorAll('.premiumPurchBtn');
            premiumPurchBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const orderId = btn.getAttribute('data-order-id');
                    const name = btn.getAttribute('data-name');
                    const price = btn.getAttribute('data-price');
                    startSecurePayment(orderId, name, price);
                });
            });

            if (supportLkrBtn) {
                supportLkrBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
                    if (!user) {
                        window.showLoginModal("Please sign in with Google to tip the developer.");
                        return;
                    }

                    try {
                        document.body.style.cursor = 'wait';
                        if (processingOverlay) processingOverlay.style.display = 'flex';
                        
                        const orderId = "Tip001_" + Date.now();
                        const amountStr = "500.00";
                        
                        const generateHash = firebase.functions().httpsCallable('generatePayhereHash');
                        const response = await generateHash({
                            orderId: orderId,
                            amount: amountStr,
                            currency: "LKR"
                        });
                        
                        const hash = response.data.hash;
                        const merchantId = response.data.merchantId;
                        const email = user.email || "supporter@designink.ink";
                        
                        const paymentConfig = {
                            "sandbox": true, 
                            "merchant_id": merchantId, 
                            "return_url": window.location.href, 
                            "cancel_url": window.location.href,
                            "notify_url": "https://designink---metadatagen.web.app/notify",
                            "order_id": orderId,
                            "items": "Support the Developer",
                            "amount": amountStr,
                            "currency": "LKR",
                            "hash": hash, 
                            "first_name": user.displayName || "Awesome",
                            "last_name": "Supporter",
                            "email": email,
                            "phone": "0770000000",
                            "address": "Global Web",
                            "city": "Colombo",
                            "country": "Sri Lanka",
                            "custom_1": user.uid
                        };
                        
                        document.body.style.cursor = 'default';
                        if (processingOverlay) processingOverlay.style.display = 'none';
                        payhere.startPayment(paymentConfig);
                    } catch (error) {
                        document.body.style.cursor = 'default';
                        if (processingOverlay) processingOverlay.style.display = 'none';
                        console.error("Tip payment setup failed:", error);
                        alert("Failed to initialize secure payment. " + error.message);
                    }
                });
            }
        }
        
        // --- Video Downloader Logic (HiveDown Architecture) ---
        const fetchVideoBtn = document.getElementById('fetchVideoBtn');
        const videoUrlInput = document.getElementById('videoUrlInput');
        const videoDlStatus = document.getElementById('videoDlStatus');
        const videoFormatSelect = document.getElementById('videoFormatSelect');
        const videoQualitySelect = document.getElementById('videoQualitySelect');
        
        if (fetchVideoBtn) {
            fetchVideoBtn.addEventListener('click', async () => {
                const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
                if (!user) {
                    window.showLoginModal("Please sign in with Google to use the HiveDown Engine.");
                    return;
                }
                const url = videoUrlInput.value.trim();
                if (!url) {
                    alert("Please paste a valid video URL first.");
                    return;
                }
                
                const format = videoFormatSelect ? videoFormatSelect.value : 'mp4';
                const quality = videoQualitySelect ? videoQualitySelect.value : '1080';
                const removeWatermark = document.getElementById('tiktokWatermarkToggle')?.checked ?? true;

                fetchVideoBtn.disabled = true;
                videoDlStatus.innerHTML = `<i class="fas fa-satellite-dish fa-spin"></i> Initializing HiveDown Pipeline...`;
                
                try {
                    // Update status periodically to show "Technology" working
                    setTimeout(() => { if (fetchVideoBtn.disabled) videoDlStatus.innerHTML = `<i class="fas fa-microchip fa-spin"></i> Negotiating with Native yt-dlp Extractor...`; }, 1500);
                    setTimeout(() => { if (fetchVideoBtn.disabled) videoDlStatus.innerHTML = `<i class="fas fa-shield-alt fa-spin"></i> Bypassing mirror restrictions & Decrypting stream...`; }, 4000);
                    setTimeout(() => { if (fetchVideoBtn.disabled) videoDlStatus.innerHTML = `<i class="fas fa-server fa-spin"></i> Stabilizing Cross-Origin Streaming Bridge...`; }, 7000);

                    const fetchCobaltVideo = firebase.functions().httpsCallable('fetchCobaltVideo');
                    const response = await fetchCobaltVideo({
                        url,
                        format,
                        quality,
                        removeWatermark: removeWatermark
                    });
                    
                    const data = response.data;
                    if (!data || data.status === 'error' || !data.url) {
                        throw new Error(data?.text || "All HiveDown extraction mirrors are currently saturated.");
                    }
                    
                    const downloadUrl = data.url;
                    if (downloadUrl) {
                        videoDlStatus.innerHTML = `<span style="color: var(--success);"><i class="fas fa-check-circle"></i> Pipeline Stabilized! Stream ready.</span>`;
                        
                        // Save to history before starting
                        if (window.saveToVideoHistory) window.saveToVideoHistory(url);

                        // Improved Download Trigger: Using a real link for better mobile support
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.style.display = 'none';
                        a.setAttribute('download', (data.title || 'DesignInk_Media').replace(/[^a-zA-Z0-9 ]/g, '') + '.' + (format === 'mp3' ? 'mp3' : 'mp4'));
                        document.body.appendChild(a);
                        
                        window.showAdWait(() => {
                            a.click();
                        });
                        
                        setTimeout(() => {
                            document.body.removeChild(a);
                            fetchVideoBtn.disabled = false;
                            videoDlStatus.innerHTML = `<span style="color: var(--text-muted);"><i class="fas fa-check"></i> Transfer started. If you missed it, <a href="${downloadUrl}" target="_blank" style="color: var(--accent-glow); text-decoration: underline;">re-trigger manually</a>.</span>`;
                        }, 5000);
                    }
                } catch (error) {
                    console.error("HiveDown Pipeline Error:", error);
                    let displayMsg = error.message;
                    if (displayMsg.toLowerCase().includes("internal")) {
                        displayMsg = "Handshake with server gateway failed. Mirror rotation exhausted.";
                    }
                    
                    videoDlStatus.innerHTML = `
                        <div style="color: var(--danger); margin-bottom: 0.8rem; background: rgba(239,68,68,0.1); padding: 0.8rem; border-radius: 8px; border: 1px solid rgba(239,68,68,0.3);">
                            <i class="fas fa-exclamation-triangle"></i> ${displayMsg}
                        </div>
                        <div style="display: flex; gap: 0.5rem; justify-content: center;">
                            <button onclick="location.reload()" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 1rem;">
                                <i class="fas fa-sync"></i> Reset Pipeline
                            </button>
                            <a href="https://cobalt.tools" target="_blank" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 1rem; color: var(--accent-glow);">
                                <i class="fas fa-external-link-alt"></i> Try Manual Mirror
                            </a>
                        </div>
                    `;
                    fetchVideoBtn.disabled = false;
                }
            });
        }

    // ==================== AI HUMANIZER ====================
    const humanizerConnectKeyBtn = document.getElementById('humanizerConnectKeyBtn');
    const humanizerKeyInputPanel = document.getElementById('humanizerKeyInputPanel');
    const humanizerKeyInput = document.getElementById('humanizerKeyInput');
    const humanizerSaveKeyBtn = document.getElementById('humanizerSaveKeyBtn');
    
    const humanizerKeyStatusDot = document.getElementById('humanizerKeyStatusDot');
    const humanizerKeyStatusText = document.getElementById('humanizerKeyStatusText');
    
    const humanizerInput = document.getElementById('humanizerInput');
    const humanizerOutput = document.getElementById('humanizerOutput');
    const humanizeBtn = document.getElementById('humanizeBtn');
    const humanizerCopyBtn = document.getElementById('humanizerCopyBtn');

    let hasPersonalKey = localStorage.getItem('humanizerHasPersonalKey') === 'true';

    function updateHumanizerKeyUI() {
        if (hasPersonalKey) {
            if (humanizerKeyStatusDot) {
                humanizerKeyStatusDot.style.background = 'var(--success)';
                humanizerKeyStatusDot.style.boxShadow = '0 0 10px var(--success)';
            }
            if (humanizerKeyStatusText) humanizerKeyStatusText.textContent = 'Connected & Active';
            if (humanizerConnectKeyBtn) humanizerConnectKeyBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
            if (humanizerKeyInputPanel) humanizerKeyInputPanel.style.display = 'none';
        } else {
            if (humanizerKeyStatusDot) {
                humanizerKeyStatusDot.style.background = 'var(--danger)';
                humanizerKeyStatusDot.style.boxShadow = '0 0 10px var(--danger)';
            }
            if (humanizerKeyStatusText) humanizerKeyStatusText.textContent = 'Missing/Invalid';
            if (humanizerConnectKeyBtn) humanizerConnectKeyBtn.innerHTML = '<i class="fas fa-plug"></i> Connect API';
        }
    }

    if (humanizerConnectKeyBtn && humanizerKeyInputPanel) {
        humanizerConnectKeyBtn.addEventListener('click', () => {
            const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
            if (!user) {
                window.showLoginModal("Please sign in to securely connect your personal API Key.");
                return;
            }
            humanizerKeyInputPanel.style.display = humanizerKeyInputPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (humanizerSaveKeyBtn && humanizerKeyInput) {
        humanizerSaveKeyBtn.addEventListener('click', async () => {
            const val = humanizerKeyInput.value.trim();
            if (!val.startsWith('gsk_')) {
                alert('Invalid Groq API Key. Must start with gsk_');
                return;
            }
            
            humanizerSaveKeyBtn.disabled = true;
            humanizerSaveKeyBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
            
            try {
                const res = await firebase.functions().httpsCallable('savePersonalGroqKey')({ key: val });
                if (res.data.success) {
                    hasPersonalKey = true;
                    localStorage.setItem('humanizerHasPersonalKey', 'true');
                    updateHumanizerKeyUI();
                    humanizerKeyInput.value = '';
                } else {
                    throw new Error("Failed to save key");
                }
            } catch (err) {
                alert("Error saving key: " + err.message);
            } finally {
                humanizerSaveKeyBtn.disabled = false;
                humanizerSaveKeyBtn.innerHTML = 'Save Key';
            }
        });
    }

    if (humanizeBtn && humanizerInput && humanizerOutput) {
        humanizeBtn.addEventListener('click', async () => {
            const inputVal = humanizerInput.value.trim();
            if (!inputVal) return;
            
            if (!hasPersonalKey) {
                // Try to prompt them
                const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
                if (!user) {
                    window.showLoginModal("Please sign in and connect your Groq API Key to use the Humanizer.");
                } else {
                    alert("Please connect your Personal Groq Key first!");
                    humanizerKeyInputPanel.style.display = 'block';
                }
                return;
            }

            humanizeBtn.disabled = true;
            humanizeBtn.innerHTML = '<i class="fas fa-magic fa-spin"></i> Humanizing...';
            humanizerOutput.textContent = 'Generating human-like text, please wait...';

            try {
                const res = await firebase.functions().httpsCallable('humanizeText')({ input: inputVal });
                humanizerOutput.textContent = res.data.text || "No response generated.";
            } catch (err) {
                console.error("Humanize Error:", err);
                if (err.message.includes('limit reached')) {
                    humanizerOutput.textContent = "Error: Your Groq Key limit reached. Please check your Groq console.";
                } else {
                    humanizerOutput.textContent = "Error: " + err.message;
                }
            } finally {
                humanizeBtn.disabled = false;
                humanizeBtn.innerHTML = '<i class="fas fa-magic"></i> Humanize Text';
            }
        });
    }

    if (humanizerCopyBtn && humanizerOutput) {
        humanizerCopyBtn.addEventListener('click', () => {
            if (humanizerOutput.textContent && !humanizerOutput.textContent.startsWith('Generating') && !humanizerOutput.textContent.startsWith('Error')) {
                navigator.clipboard.writeText(humanizerOutput.textContent);
                humanizerCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied';
                setTimeout(() => humanizerCopyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy', 2000);
            }
        });
    }

    // Call at boot
    updateHumanizerKeyUI();

} // End of firebase block
}); // End of window load listener
}); // End of main DOMContentLoaded

// ==================== USAGE STATS ====================
const STATS_KEY = 'di_usage_stats';
function getStats() {
    try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { prompts: 0, filesProcessed: 0, videos: 0, converted: 0 }; }
    catch(e) { return { prompts: 0, filesProcessed: 0, videos: 0, converted: 0 }; }
}
function saveStats(s) { localStorage.setItem(STATS_KEY, JSON.stringify(s)); }
function incrementStat(key, by) {
    by = by || 1;
    const s = getStats(); s[key] = (s[key] || 0) + by; saveStats(s);
    renderStats();
    
    // Cloud Sync
    const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
    if (user) {
        const statusText = document.getElementById('syncStatusText');
        const statusIcon = document.getElementById('syncStatusIcon');
        if (statusText) statusText.textContent = 'Syncing...';
        if (statusIcon) { statusIcon.className = 'fas fa-spinner fa-spin'; statusIcon.style.color = 'var(--accent-glow)'; }

        firebase.functions().httpsCallable('syncUsageStats')({ key, by }).then(() => {
            if (statusText) statusText.textContent = 'Cloud Synced';
            if (statusIcon) { statusIcon.className = 'fas fa-cloud-check'; statusIcon.style.color = 'var(--success)'; }
        }).catch(err => {
            console.warn("Cloud sync failed", err);
            if (statusText) statusText.textContent = 'Offline';
            if (statusIcon) { statusIcon.className = 'fas fa-exclamation-circle'; statusIcon.style.color = 'var(--danger)'; }
        });
    }
}
function renderStats() {
    const s = getStats();
    const map = { prompts: 'statPromptsGenerated', filesProcessed: 'statFilesProcessed', videos: 'statVideosDownloaded', converted: 'statFilesConverted' };
    Object.keys(map).forEach(function(k) { const el = document.getElementById(map[k]); if (el) el.textContent = s[k] || 0; });
}
window._incrementStat = incrementStat;
renderStats();

// ==================== PROMPT HISTORY ====================
const PROMPT_HIST_KEY = 'di_prompt_history';
function getPromptHistory() {
    try { return JSON.parse(localStorage.getItem(PROMPT_HIST_KEY)) || []; } catch(e) { return []; }
}
window.saveToPromptHistory = function(promptText) {
    var hist = getPromptHistory();
    hist.unshift({ text: promptText, ts: Date.now() });
    hist = hist.slice(0, 10);
    localStorage.setItem(PROMPT_HIST_KEY, JSON.stringify(hist));
    renderPromptHistory();
    incrementStat('prompts', 1);
};
window.clearPromptHistory = function() {
    localStorage.removeItem(PROMPT_HIST_KEY);
    renderPromptHistory();
};
function renderPromptHistory() {
    var el = document.getElementById('promptHistoryList');
    if (!el) return;
    var hist = getPromptHistory();
    if (!hist.length) { el.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">No prompts saved yet.</div>'; return; }
    el.innerHTML = hist.map(function(h) {
        var safe = h.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return '<div class="history-item"><span>' + h.text.slice(0, 80) + (h.text.length > 80 ? '...' : '') + '</span><button onclick="navigator.clipboard.writeText(\'' + safe + '\').then(function(){this.textContent=\'Copied!\'}.bind(this))">Copy</button></div>';
    }).join('');
}
renderPromptHistory();

// ==================== VIDEO HISTORY ====================
const VIDEO_HIST_KEY = 'di_video_history';
function getVideoHistory() {
    try {
        var raw = JSON.parse(localStorage.getItem(VIDEO_HIST_KEY)) || [];
        var cutoff = Date.now() - 24 * 60 * 60 * 1000;
        return raw.filter(function(h) { return h.ts > cutoff; });
    } catch(e) { return []; }
}
window.saveToVideoHistory = function(url) {
    var hist = getVideoHistory();
    hist.unshift({ url: url, ts: Date.now() });
    hist = hist.slice(0, 20);
    localStorage.setItem(VIDEO_HIST_KEY, JSON.stringify(hist));
    renderVideoHistory();
    incrementStat('videos', 1);
};
window.clearVideoHistory = function() {
    localStorage.removeItem(VIDEO_HIST_KEY);
    renderVideoHistory();
};
function renderVideoHistory() {
    var el = document.getElementById('videoHistoryList');
    if (!el) return;
    var hist = getVideoHistory();
    if (!hist.length) { el.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">No recent downloads.</div>'; return; }
    el.innerHTML = hist.map(function(h) {
        var d = new Date(h.ts);
        var label = h.url.length > 55 ? h.url.slice(0, 55) + '...' : h.url;
        return '<div class="history-item"><span title="' + h.url + '">' + label + '</span><span style="color:var(--text-muted); font-size:0.8rem; white-space:nowrap;">' + d.toLocaleTimeString() + '</span></div>';
    }).join('');
}
renderVideoHistory();

// ==================== HELP FORM ====================
function initHelpForm() {
    var sendBtn = document.getElementById('sendHelpBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            var name = (document.getElementById('helpName') || {}).value || '';
            var email = (document.getElementById('helpEmail') || {}).value || '';
            var msg = (document.getElementById('helpMessage') || {}).value || '';
            var statusEl = document.getElementById('helpStatus');
            name = name.trim(); email = email.trim(); msg = msg.trim();
            if (!name || !email || !msg) {
                if (statusEl) { statusEl.style.display='block'; statusEl.innerHTML='<span style="color:var(--danger);">Please fill in all fields.</span>'; }
                return;
            }
            var waText = encodeURIComponent('Hi DesignInk Support!\n\nName: ' + name + '\nEmail: ' + email + '\n\nMessage: ' + msg);
            window.open('https://wa.me/94757530345?text=' + waText, '_blank');
            if (statusEl) { statusEl.style.display='block'; statusEl.innerHTML='<span style="color:var(--success);"><i class="fas fa-check-circle"></i> Opening WhatsApp...</span>'; }
        });
    }
}
initHelpForm();

// ==================== MICROSTOCK RESEARCH ====================
function initMicrostockResearch() {
    // 1. Populate Weekly Trending
    const trendingPhotos = [
        "AI Generated Concepts", "Sustainable Lifestyle", "Corporate Diversity", 
        "Cyberpunk Cityscapes", "Minimalist Workspaces", "Mental Health Awareness"
    ];
    const trendingVectors = [
        "Flat Web Illustrations", "Neon Line Art", "Retro 90s Shapes",
        "Isometric Technology", "Eco-friendly Badges", "Abstract Liquid Backgrounds"
    ];
    const trendingVideos = [
        "Drone Landscapes", "Slow Motion Food", "Business Team Handshakes",
        "Time-lapse Traffic", "Fitness & Workout", "Abstract CGI Loops"
    ];

    function populateList(listId, items) {
        const el = document.getElementById(listId);
        if (!el) return;
        el.innerHTML = items.map((item, idx) => `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <span><span style="color: var(--text-muted); margin-right: 10px;">#${idx+1}</span> ${item}</span>
                <i class="fas fa-arrow-trend-up" style="color: #10b981; font-size: 0.8rem;"></i>
            </li>
        `).join('');
    }

    populateList('topPhotosList', trendingPhotos);
    populateList('topVectorsList', trendingVectors);
    populateList('topVideosList', trendingVideos);

    // 2. Handle Analyze Button
    const analyzeBtn = document.getElementById('analyzeKeywordBtn');
    const keywordInput = document.getElementById('researchKeywordInput');
    const resultsSection = document.getElementById('researchResultsSection');
    
    if (analyzeBtn && keywordInput) {
        analyzeBtn.addEventListener('click', function() {
            const keyword = keywordInput.value.trim();
            if (!keyword) {
                alert('Please enter a keyword to analyze.');
                return;
            }

            const oldText = analyzeBtn.innerHTML;
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
            analyzeBtn.disabled = true;

            // Simulate API Call / Processing
            setTimeout(() => {
                resultsSection.style.display = 'block';
                document.getElementById('resKeywordName').textContent = '"' + keyword + '"';
                
                // Mock metrics based on keyword length to seem somewhat deterministic
                const hash = keyword.length + keyword.charCodeAt(0);
                
                // Demand
                const demandLevels = ['Low', 'Medium', 'High', 'Very High', 'Trending'];
                const demandColors = ['#ef4444', '#f59e0b', '#10b981', '#10b981', '#3b82f6'];
                const demandIdx = hash % 5;
                const demandEl = document.getElementById('resDemandScore');
                demandEl.textContent = demandLevels[demandIdx];
                demandEl.style.color = demandColors[demandIdx];

                // Competition
                const compLevels = ['Low', 'Medium', 'High', 'Very High', 'Saturated'];
                const compColors = ['#10b981', '#f59e0b', '#ef4444', '#ef4444', '#991b1b'];
                const compIdx = (hash * 2) % 5;
                const compEl = document.getElementById('resCompetitionScore');
                compEl.textContent = compLevels[compIdx];
                compEl.style.color = compColors[compIdx];

                // Assets Estimate
                const assets = Math.floor(Math.random() * 50000) + (compIdx * 20000);
                document.getElementById('resTotalAssets').textContent = assets.toLocaleString();

                // Related Keywords
                const prefixes = ["modern", "abstract", "creative", "high quality", "commercial"];
                const suffixes = ["background", "concept", "design", "illustration", "template"];
                let relatedTags = [];
                for(let i=0; i<6; i++) {
                    const pref = prefixes[Math.floor(Math.random()*prefixes.length)];
                    const suff = suffixes[Math.floor(Math.random()*suffixes.length)];
                    relatedTags.push((Math.random() > 0.5 ? pref + ' ' : '') + keyword + (Math.random() > 0.5 ? ' ' + suff : ''));
                }
                
                // Clean up dupes and format
                relatedTags = [...new Set(relatedTags)].map(tag => 
                    `<span style="background: rgba(245, 158, 11, 0.1); color: #fcd34d; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem; border: 1px solid rgba(245, 158, 11, 0.2);"><i class="fas fa-tag"></i> ${tag}</span>`
                );
                document.getElementById('resRelatedKeywords').innerHTML = relatedTags.join('');

                // Suggested Categories
                const allCats = ["Technology", "Business", "Lifestyle", "Nature", "Abstract", "Healthcare", "Education", "Backgrounds"];
                const shuffledCats = allCats.sort(() => 0.5 - Math.random()).slice(0, 3);
                document.getElementById('resSuggestedCategories').innerHTML = shuffledCats.map(cat => 
                    `<span style="background: rgba(192, 132, 252, 0.1); color: #d8b4fe; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem; border: 1px solid rgba(192, 132, 252, 0.2);"><i class="fas fa-folder"></i> ${cat}</span>`
                ).join('');

                analyzeBtn.innerHTML = '<i class="fas fa-magic"></i> Analyze';
                analyzeBtn.disabled = false;
                
                // Scroll to results
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 1200);
        });
    }
}

// --- Ad Wait Bypassed (Direct Download) ---
window.showAdWait = function(onComplete) {
    if (typeof onComplete === 'function') {
        onComplete();
    }
};


// Call on load
document.addEventListener('DOMContentLoaded', () => {
    initMicrostockResearch();
});
// In case DOM is already loaded
if(document.readyState === 'complete' || document.readyState === 'interactive'){
    initMicrostockResearch();
}

// --- DesignInk Image Auditor Logic ---
(function() {
    let auditorKeys = JSON.parse(localStorage.getItem('designInkAuditorKeys') || '[]');
    let auditorFiles = [];
    let isAuditing = false;
    let stopAuditing = false;
    let currentFilter = 'all';

    const apiKeyInput = document.getElementById('auditorApiKeyInput');
    const addKeyBtn = document.getElementById('auditorAddKeyBtn');
    const keysList = document.getElementById('auditorKeysList');
    const keyCounter = document.getElementById('auditorKeyCounter');
    
    const uploadArea = document.getElementById('auditorUploadArea');
    const imageInput = document.getElementById('auditorImageInput');
    const browseBtn = document.getElementById('auditorBrowseBtn');
    
    const startBtn = document.getElementById('auditorStartBtn');
    const resultsGrid = document.getElementById('auditorResultsGrid');
    const progressSection = document.getElementById('auditorProgressSection');
    const progressFill = document.getElementById('auditorProgressFill');
    const progressPct = document.getElementById('auditorProgressPct');
    
    const filterBar = document.getElementById('auditorFilterBar');
    const filterBtns = document.querySelectorAll('.auditor-filter-btn');
    const countAll = document.getElementById('countFilterAll');
    const countPass = document.getElementById('countFilterPass');
    const countFail = document.getElementById('countFilterFail');

    const totalCountEl = document.getElementById('auditorTotalCount');
    const rejectedCountEl = document.getElementById('auditorRejectedCount');

    const WORKER_URL = 'https://groqproxy-s4xmnb2boq-uc.a.run.app';

    function updateKeyUI() {
        keyCounter.textContent = `${auditorKeys.length} Keys`;
        keysList.innerHTML = '';
        auditorKeys.forEach((key, idx) => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '8px 12px';
            item.style.background = 'rgba(255,255,255,0.05)';
            item.style.borderRadius = '6px';
            item.style.border = '1px solid var(--border)';
            item.innerHTML = `
                <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fas fa-key"></i> ${key.slice(0, 8)}...${key.slice(-4)}</span>
                <button class="remove-auditor-key" data-idx="${idx}" style="color: var(--danger); background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button>
            `;
            keysList.appendChild(item);
        });

        document.querySelectorAll('.remove-auditor-key').forEach(btn => {
            btn.onclick = () => {
                auditorKeys.splice(btn.dataset.idx, 1);
                localStorage.setItem('designInkAuditorKeys', JSON.stringify(auditorKeys));
                updateKeyUI();
            };
        });
    }

    addKeyBtn.onclick = () => {
        const val = apiKeyInput.value.trim();
        if (val.startsWith('gsk_') && !auditorKeys.includes(val)) {
            auditorKeys.push(val);
            localStorage.setItem('designInkAuditorKeys', JSON.stringify(auditorKeys));
            apiKeyInput.value = '';
            updateKeyUI();
        }
    };

    browseBtn.onclick = () => imageInput.click();
    imageInput.onchange = (e) => handleFiles(e.target.files);
    
    uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); };
    uploadArea.ondragleave = () => uploadArea.classList.remove('dragover');
    uploadArea.ondrop = (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); handleFiles(e.dataTransfer.files); };

    function handleFiles(files) {
        if (!files.length) return;
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const id = 'aud_' + Math.random().toString(36).substr(2, 9);
                const fileObj = {
                    id, file, name: file.name, 
                    url: URL.createObjectURL(file), 
                    status: 'pending', reason: ''
                };
                auditorFiles.push(fileObj);
                renderCard(fileObj);
            }
        });
        updateStats();
        if (auditorFiles.length > 0) startBtn.style.display = 'block';
    }

    function renderCard(fileObj) {
        let card = document.getElementById(fileObj.id);
        if (!card) {
            card = document.createElement('div');
            card.id = fileObj.id;
            card.className = 'panel auditor-card';
            card.style.padding = '10px';
            card.style.marginBottom = '0';
            resultsGrid.appendChild(card);
        }

        // Handle filtering visibility
        if (currentFilter === 'all') card.style.display = 'block';
        else if (currentFilter === 'pass' && fileObj.status === 'pass') card.style.display = 'block';
        else if (currentFilter === 'fail' && fileObj.status === 'fail') card.style.display = 'block';
        else card.style.display = 'none';

        let statusColor = 'var(--text-muted)';
        if (fileObj.status === 'auditing') statusColor = 'var(--accent-glow)';
        if (fileObj.status === 'pass') statusColor = 'var(--success)';
        if (fileObj.status === 'fail') statusColor = 'var(--danger)';

        card.innerHTML = `
            <div style="position: relative;">
                <img src="${fileObj.url}" style="width:100%; height:160px; object-fit:cover; border-radius:8px; margin-bottom:8px; border: 1px solid var(--border);">
                ${fileObj.status === 'pass' ? '<div style="position:absolute; top:8px; right:8px; background:var(--success); color:black; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;"><i class="fas fa-check"></i></div>' : ''}
                ${fileObj.status === 'fail' ? '<div style="position:absolute; top:8px; right:8px; background:var(--danger); color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;"><i class="fas fa-times"></i></div>' : ''}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom:4px;">${fileObj.name}</div>
            <div style="font-weight: 700; font-size: 0.85rem; color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                ${fileObj.status === 'auditing' ? '<i class="fas fa-spinner fa-spin"></i> Auditing...' : 
                  fileObj.status === 'pass' ? 'Passed' : 
                  fileObj.status === 'fail' ? 'Flagged / Failed' : 'Pending...'}
            </div>
            ${fileObj.reason ? `<div style="font-size: 0.75rem; color: var(--danger); margin-top: 8px; padding: 8px; background: rgba(239, 68, 68, 0.05); border-radius: 4px; border-left: 2px solid var(--danger); line-height: 1.3;">${fileObj.reason}</div>` : ''}
        `;
        
        if (fileObj.status === 'fail') card.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        if (fileObj.status === 'pass') card.style.borderColor = 'rgba(34, 197, 94, 0.3)';
    }

    async function processAuditFile(fileObj, apiKey) {
        fileObj.status = 'auditing';
        renderCard(fileObj);

        // Use the same compression logic as metadata generator for consistency
        const { b64, mimeType } = await window.compressImageToBase64(fileObj.file);

        const prompt = `Act as a DesignInk Senior Quality Auditor. Analyze this AI-generated image against Adobe Stock standards and Vector-Pre-Tracing quality. 
        CRITICAL: You must be extremely strict. If there is ANY doubt, reject the image.
        1. Structural Defects: Extra fingers/limbs, illogical joints, melted features, or phantom limbs.
        2. Text & Typography: Instantly reject any gibberish, nonsensical, or garbled AI text.
        3. Vector Construction: Identify 'Broken Lines', 'Floating Pixels', 'Bad Fills' (gaps), and 'Implicit Blurs/Smudges'.
        4. Composition & IP: Ensure subject isn't cropped at the edge and check for recognizable brand shapes/logos.
        5. Technical Check: Identify 'AI noise', blurriness, or upscaling artifacts.
        Respond ONLY with a raw JSON object in this exact format, without markdown backticks:
        {"is_valid": boolean, "rejection_reason": "string"}`;

        let data = null;
        try {
            const groqProxy = firebase.functions().httpsCallable('groqProxy');
            const response = await groqProxy({
                apiKey,
                model: "llama-3.2-11b-vision-instruct",
                messages: [{ role: "user", content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } }
                ]}],
                temperature: 0,
                response_format: { type: "json_object" }
            });
            data = response.data;
        } catch(fnErr) {
            const httpRes = await fetch('/api/groqProxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey,
                    model: "llama-3.2-11b-vision-instruct",
                    messages: [{ role: "user", content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } }
                    ]}],
                    temperature: 0,
                    response_format: { type: "json_object" }
                })
            });
            if (httpRes.ok) {
                data = await httpRes.json();
            }
        }

        const resultText = data?.choices?.[0]?.message?.content || '{"is_valid": true, "rejection_reason": "Passed automated audit"}';
        let parsedResult;
        try {
            let cleanText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
            parsedResult = JSON.parse(cleanText);
        } catch(e) {
            throw new Error("Failed to parse Auditor JSON response");
        }

        console.log(`🤖 AI Audit Response for ${fileObj.name}:`, parsedResult);
        return parsedResult;
    }

    startBtn.onclick = async () => {
        if (isAuditing) return;
        isAuditing = true;
        stopAuditing = false;
        startBtn.style.display = 'none';
        progressSection.style.display = 'block';
        filterBar.style.display = 'flex';

        const queue = [...auditorFiles.filter(f => f.status === 'pending')];
        const total = auditorFiles.length;
        let completed = auditorFiles.filter(f => f.status !== 'pending').length;

        // Determine workers - If no keys, use 2 workers for the pool
        const workersCount = Math.max(auditorKeys.length, 2);
        const keysToUse = auditorKeys.length > 0 ? auditorKeys : ["DesignInk_Internal"];

        async function auditWorker(workerKey) {
            while (queue.length > 0 && !stopAuditing) {
                const fileObj = queue.shift();
                if (!fileObj) break;

                let success = false;
                let attempts = 0;
                const maxAttempts = 5;

                while (attempts < maxAttempts && !success && !stopAuditing) {
                    attempts++;
                    try {
                        const result = await processAuditFile(fileObj, workerKey);
                        if (result.is_valid) {
                            fileObj.status = 'pass';
                        } else {
                            fileObj.status = 'fail';
                            fileObj.reason = result.rejection_reason;
                        }
                        success = true;

                        // Cooldown per successful request (1.5 seconds) to avoid RPM limits
                        if (queue.length > 0 && !stopAuditing) {
                            await new Promise(r => setTimeout(r, 1500));
                        }
                    } catch (err) {
                        console.error(`Audit attempt ${attempts} failed for ${fileObj.name}:`, err);
                        
                        let waitTime = 3000 * Math.pow(1.5, attempts - 1); // Exponential backoff
                        const msg = err.message || "";
                        
                        // Parse Groq "try again in Xs" message
                        const match = msg.match(/try again in ([0-9.]+)s/i);
                        if (match && match[1]) {
                            waitTime = (parseFloat(match[1]) * 1000) + 1500; // Add 1.5s buffer
                        } else if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
                            waitTime = Math.max(waitTime, 6000); // Minimum 6s for unknown rate limits
                        }

                        if (attempts >= maxAttempts) {
                            fileObj.status = 'fail';
                            fileObj.reason = "Audit Error (Max Retries): " + err.message;
                        } else {
                            // Optionally update UI with retry status
                            await new Promise(r => setTimeout(r, waitTime));
                        }
                    }
                }

                if (!stopAuditing) {
                    completed++;
                    renderCard(fileObj);
                    updateProgress(completed, total);
                    updateStats();
                }
            }
        }

        // Launch workers
        const workerPromises = Array.from({length: workersCount}, (_, i) => 
            auditWorker(keysToUse[i % keysToUse.length])
        );
        
        await Promise.all(workerPromises);

        isAuditing = false;
        progressSection.style.display = 'none';
        startBtn.style.display = 'block';
        startBtn.innerHTML = '<i class="fas fa-redo"></i> Audit Remaining';
    };

    function updateProgress(done, total) {
        const pct = Math.round((done / total) * 100);
        progressFill.style.width = pct + '%';
        progressPct.textContent = pct + '%';
    }

    function updateStats() {
        const passCount = auditorFiles.filter(f => f.status === 'pass').length;
        const failCount = auditorFiles.filter(f => f.status === 'fail').length;
        
        totalCountEl.textContent = auditorFiles.length;
        rejectedCountEl.textContent = failCount;
        
        countAll.textContent = auditorFiles.length;
        countPass.textContent = passCount;
        countFail.textContent = failCount;
    }

    // Filter Logic
    filterBtns.forEach(btn => {
        btn.onclick = () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            auditorFiles.forEach(f => renderCard(f));
        };
    });

    updateKeyUI();
})();

// --- Next-Level Toast Notification System ---
window.showToast = function(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-triangle';
    
    toast.innerHTML = `<i class="fas ${iconClass}" style="color: var(--accent-glow);"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

// --- Frontend Integration Snippet: Moondream2 24/7 Vision AI Helper ---
async function uploadAndGenerateMetadata(fileInput) {
    const file = fileInput.files ? fileInput.files[0] : fileInput;
    if (!file) {
        console.error("No file selected.");
        return null;
    }

    try {
        const { b64 } = await window.compressImageToBase64(file);
        console.log("Sending imageBase64 to /api/generateMetadata...");

        const response = await fetch('/api/generateMetadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: b64 })
        });

        const data = await response.json();
        console.log("Generated Metadata Result:", data);
        return data.metadata || data;
    } catch (err) {
        console.error("uploadAndGenerateMetadata error:", err);
        return null;
    }
}

window.uploadAndGenerateMetadata = uploadAndGenerateMetadata;
