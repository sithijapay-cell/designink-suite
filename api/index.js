const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "DesignInk_SafeKey_12345678901234";

// --- In-Memory Key Cooldown & Rotation Manager ---
const keyCooldowns = new Map(); // key -> cooldownUntil timestamp

function getEnvKeys(envVarName) {
    const raw = process.env[envVarName] || "";
    if (!raw) return [];
    return raw.split(',').map(k => k.trim()).filter(k => k.length > 5);
}

function isKeyInCooldown(key) {
    if (!key) return true;
    const cooldownUntil = keyCooldowns.get(key);
    if (cooldownUntil && cooldownUntil > Date.now()) {
        return true;
    }
    if (cooldownUntil && cooldownUntil <= Date.now()) {
        keyCooldowns.delete(key);
    }
    return false;
}

function markKeyCooldown(key, durationMs = 300000) { // default 5 minutes
    if (key) {
        keyCooldowns.set(key, Date.now() + durationMs);
        console.warn(`[KeyManager] Key (${key.substring(0, 6)}...) placed on ${Math.round(durationMs/1000)}s in-memory cooldown.`);
    }
}

function parseUserMessagePayload(messages) {
    let textPrompt = "";
    let mimeType = "image/jpeg";
    let base64Data = "";

    try {
        if (Array.isArray(messages)) {
            const textParts = [];
            for (const msg of messages) {
                if (Array.isArray(msg.content)) {
                    for (const item of msg.content) {
                        if (item.type === "text" && item.text) {
                            textParts.push(item.text);
                        } else if (item.type === "image_url" && item.image_url?.url) {
                            const dataUrl = item.image_url.url;
                            if (dataUrl.startsWith("data:")) {
                                const commaIdx = dataUrl.indexOf(",");
                                if (commaIdx !== -1) {
                                    const header = dataUrl.substring(0, commaIdx);
                                    base64Data = dataUrl.substring(commaIdx + 1).trim();
                                    const mimeMatch = header.match(/^data:([^;]+);/);
                                    if (mimeMatch) mimeType = mimeMatch[1];
                                }
                            }
                        }
                    }
                } else if (typeof msg.content === "string") {
                    textParts.push(msg.content);
                }
            }
            textPrompt = textParts.join("\n");
        }
    } catch(e) {}

    if (!textPrompt) {
        textPrompt = "Generate stock photo metadata in raw JSON object format with title, description, keywords.";
    }

    return { textPrompt, mimeType, base64Data };
}

async function callNativeGemini(apiKey, textPrompt, mimeType, base64Data, temperature, requestedModel, isJson = true) {
    // Primary Vision Provider Priority Array (Updated: 2026)
    const models = [
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ];
    if (requestedModel && models.includes(requestedModel)) {
        models.splice(models.indexOf(requestedModel), 1);
        models.unshift(requestedModel);
    } else if (requestedModel && !models.includes(requestedModel)) {
        models.unshift(requestedModel);
    }
    let lastErr = null;

    let cleanBase64 = base64Data || "";
    if (cleanBase64.includes(";base64,")) {
        cleanBase64 = cleanBase64.split(";base64,")[1];
    }

    for (const model of models) {
        try {
            console.log(`[Gemini] Requesting model ${model}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const generationConfig = {
                temperature: temperature ?? 0.4,
                maxOutputTokens: 2048
            };
            if (isJson) {
                generationConfig.responseMimeType = "application/json";
            }
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [
                            ...(cleanBase64 ? [{ inlineData: { mimeType: mimeType || "image/jpeg", data: cleanBase64 } }] : []),
                            { text: textPrompt }
                        ]
                    }],
                    generationConfig
                })
            });

            const data = await res.json();
            if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                let generatedContent = data.candidates[0].content.parts[0].text;
                if (isJson) {
                    generatedContent = generatedContent.replace(/```json/gi, '').replace(/```/g, '').trim();
                }
                console.log(`[Gemini] SUCCESS on model ${model}!`);
                return {
                    ok: true,
                    data: {
                        choices: [
                            { message: { content: generatedContent } }
                        ]
                    }
                };
            }

            lastErr = data.error?.message || `Gemini HTTP ${res.status}`;
            const errLower = (data.error?.message || "").toLowerCase();

            // 404 Model Not Found / Deprecated: skip to NEXT model in array cleanly
            if (res.status === 404 || errLower.includes("not found") || errLower.includes("deprecated")) {
                console.warn(`[Gemini Warning] Model '${model}' returned 404/Not Found. Skipping to next model...`);
                continue;
            }

            // 403 Account Suspended / PERMISSION_DENIED: fast-fail key immediately
            if (res.status === 403 || errLower.includes("suspended") || errLower.includes("permission_denied")) {
                console.error(`[Gemini Error] Key (${apiKey.substring(0, 6)}...) ACCOUNT SUSPENDED / PERMISSION_DENIED (HTTP ${res.status}). Skipping remaining Gemini models immediately.`);
                return { ok: false, error: `Account Suspended: ${lastErr}`, status: 403, isAccountSuspended: true };
            }

            if (res.status === 400 && errLower.includes("key")) {
                return { ok: false, error: "Invalid API Key", status: 401 };
            }

            console.error(`[Gemini Error] Model ${model} failed (HTTP ${res.status}): ${lastErr}`);
        } catch (e) {
            lastErr = e.message;
            console.error(`[Gemini Exception] Exception calling ${model}:`, e.message);
        }
    }
    return { ok: false, error: lastErr, status: 400 };
}

async function callOpenRouterWithFallback(apiKey, messages, temperature, requestedModel, isJson = true) {
    const freeModels = [
        "google/gemini-2.0-flash-001",
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "meta-llama/llama-3.2-11b-vision-instruct:free",
        "qwen/qwen-2.5-vl-72b-instruct:free",
        "qwen/qwen-2-vl-72b-instruct:free",
        "openai/gpt-4o-mini",
        "anthropic/claude-3.5-sonnet"
    ];
    if (requestedModel && !freeModels.includes(requestedModel)) {
        freeModels.unshift(requestedModel);
    } else if (requestedModel && freeModels.includes(requestedModel)) {
        freeModels.splice(freeModels.indexOf(requestedModel), 1);
        freeModels.unshift(requestedModel);
    }

    let lastErr = null;
    let lastStatus = 404;

    for (const model of freeModels) {
        try {
            console.log(`[OpenRouter] Requesting model ${model}...`);
            const reqBody = {
                model,
                messages,
                temperature: temperature ?? 0.4,
                max_tokens: 2048
            };
            if (isJson) {
                reqBody.response_format = { type: "json_object" };
            }
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://designink.ink/"
                },
                body: JSON.stringify(reqBody)
            });

            const data = await res.json();
            if (res.ok && data.choices?.[0]?.message?.content) {
                let content = data.choices[0].message.content;
                if (isJson) {
                    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
                }
                data.choices[0].message.content = content;
                console.log(`[OpenRouter] SUCCESS on model ${model}!`);
                return { ok: true, data };
            }
            lastStatus = res.status;
            lastErr = data.error?.message || `OpenRouter ${model} error ${res.status}`;
            console.error(`[OpenRouter Error] Model ${model} failed (HTTP ${res.status}): ${lastErr}`);
            if (res.status === 401 || data.error?.message?.toLowerCase().includes("key") || data.error?.message?.toLowerCase().includes("unauthorized")) {
                return { ok: false, error: "Invalid API Key", status: 401 };
            }
        } catch (e) {
            lastErr = e.message;
            console.error(`[OpenRouter Exception] Exception calling ${model}:`, e.message);
        }
    }

    return { ok: false, error: lastErr, status: lastStatus };
}

async function callGroqWithFallback(apiKey, messages, temperature, requestedModel, isJson = true) {
    const activeGroqModels = [
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
        "llama-3.2-11b-vision-instruct"
    ];

    if (requestedModel && activeGroqModels.includes(requestedModel)) {
        activeGroqModels.splice(activeGroqModels.indexOf(requestedModel), 1);
        activeGroqModels.unshift(requestedModel);
    } else if (requestedModel && !activeGroqModels.includes(requestedModel) && !requestedModel.includes('/')) {
        activeGroqModels.push(requestedModel);
    }

    let lastErr = null;
    let lastStatus = 500;

    for (const model of activeGroqModels) {
        try {
            console.log(`[Groq] Requesting model ${model}...`);
            const reqBody = {
                model,
                messages,
                temperature: temperature ?? 0.4,
                max_tokens: 2048
            };
            if (isJson) {
                reqBody.response_format = { type: "json_object" };
            }
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(reqBody)
            });

            const data = await res.json();
            if (res.ok && data.choices?.[0]?.message?.content) {
                let content = data.choices[0].message.content;
                if (isJson) {
                    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
                }
                data.choices[0].message.content = content;
                console.log(`[Groq] SUCCESS on model ${model}!`);
                return { ok: true, data };
            }
            lastStatus = res.status;
            lastErr = data.error?.message || `Groq ${model} error ${res.status}`;
            console.error(`[Groq Error] Model ${model} failed (HTTP ${res.status}): ${lastErr}`);
            if (res.status === 401 || data.error?.message?.toLowerCase().includes("invalid api key")) {
                return { ok: false, error: "Invalid API Key", status: 401 };
            }
        } catch (e) {
            lastErr = e.message;
            console.error(`[Groq Exception] Exception calling ${model}:`, e.message);
        }
    }

    return { ok: false, error: lastErr, status: lastStatus };
}

async function callGitHubModels(apiKey, messages, temperature, requestedModel, isJson = true) {
    const models = [
        "gpt-4o-mini",
        "gpt-4o",
        "meta-llama-3.1-70b-instruct",
        "Llama-3.2-11B-Vision-Instruct"
    ];
    if (requestedModel && models.includes(requestedModel)) {
        models.splice(models.indexOf(requestedModel), 1);
        models.unshift(requestedModel);
    }
    let lastErr = null;

    for (const model of models) {
        try {
            console.log(`[GitHubModels] Requesting model ${model}...`);
            const reqBody = {
                model,
                messages,
                temperature: temperature ?? 0.4,
                max_tokens: 2048
            };
            if (isJson) {
                reqBody.response_format = { type: "json_object" };
            }
            const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(reqBody)
            });

            const data = await res.json();
            if (res.ok && data.choices?.[0]?.message?.content) {
                let content = data.choices[0].message.content;
                if (isJson) {
                    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
                }
                data.choices[0].message.content = content;
                console.log(`[GitHubModels] SUCCESS on model ${model}!`);
                return { ok: true, data };
            }
            lastErr = data.error?.message || `GitHub Models ${model} ${res.status}`;
            console.error(`[GitHubModels Error] Model ${model} failed (HTTP ${res.status}): ${lastErr}`);
            if (res.status === 401 || data.error?.message?.toLowerCase().includes("unauthorized") || data.error?.message?.toLowerCase().includes("invalid api key")) {
                return { ok: false, error: "Invalid API Key", status: 401 };
            }
        } catch (e) {
            lastErr = e.message;
            console.error(`[GitHubModels Exception] Exception calling ${model}:`, e.message);
        }
    }

    return { ok: false, error: lastErr, status: 500 };
}

async function callPollinationsVision(textPrompt, mimeType, base64Data, isJson = true) {
    if (!base64Data) {
        return { ok: false, error: "No image payload for Pollinations Vision API" };
    }
    let cleanBase64 = base64Data;
    if (cleanBase64.includes(";base64,")) {
        cleanBase64 = cleanBase64.split(";base64,")[1];
    }

    const models = ["openai", "gemini", "qwen-coder"];
    for (const model of models) {
        try {
            console.log(`[PollinationsVision] Trying free vision model '${model}'...`);
            const res = await fetch("https://text.pollinations.ai/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: textPrompt },
                                { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${cleanBase64}` } }
                            ]
                        }
                    ],
                    model,
                    jsonMode: isJson
                })
            });

            if (res.ok) {
                let content = await res.text();
                if (content && content.length > 15) {
                    if (isJson) {
                        content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
                    }
                    console.log(`[PollinationsVision] SUCCESS on free model '${model}'!`);
                    return {
                        ok: true,
                        data: {
                            choices: [
                                { message: { content } }
                            ]
                        }
                    };
                }
            }
        } catch (e) {
            console.error(`[PollinationsVision Exception] Failed on ${model}: ${e.message}`);
        }
    }
    return { ok: false, error: "Pollinations free vision provider failed" };
}

function sanitizeTitle(rawTitle, targetMaxLen = 150) {
    if (!rawTitle) return "";

    let title = String(rawTitle)
        .replace(/[…\.]+$|\s*\.\.\.$/g, '')
        .replace(/\s*-\s*High Quality.*$/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    for (let i = 0; i < 2; i++) {
        title = title.replace(/\s+(?:with|and|or|of|in|on|at|to|for|the|a|an|[a-z]{1,2})$/i, '').trim();
    }

    if (title.length > targetMaxLen) {
        let cut = title.substring(0, targetMaxLen);
        const spaceIdx = cut.lastIndexOf(' ');
        if (spaceIdx > 60) {
            cut = cut.substring(0, spaceIdx);
        }
        title = cut.replace(/[\s,.-]+$/, '').trim();
    }

    return title;
}

function generateFallbackMetadata(textPrompt, base64Data = "") {
    let filenameHint = "";
    let targetCount = 45;
    if (textPrompt) {
        const match = textPrompt.match(/Filename \/ Topic Hint:\s*"([^"]+)"/i) || textPrompt.match(/topic hint:\s*"([^"]+)"/i);
        if (match) filenameHint = match[1];
        const countMatch = textPrompt.match(/Generate exactly (\d+)/i) || textPrompt.match(/(\d+)\s+keywords/i);
        if (countMatch && countMatch[1]) targetCount = parseInt(countMatch[1], 10);
    }

    const rawName = filenameHint.substring(0, filenameHint.lastIndexOf('.')) || filenameHint || "";
    const cleanTitleWords = rawName
        .replace(/_\d+K|\d{8,}/gi, '')
        .replace(/[-_]+/g, ' ')
        .replace(/[^\w\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    let titleSubject = cleanTitleWords 
        ? cleanTitleWords.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
        : "Creative Stock Asset";

    let hash = 0;
    const strForHash = (filenameHint || "image") + (base64Data ? base64Data.substring(0, 120) : "");
    for (let i = 0; i < strForHash.length; i++) {
        hash = ((hash << 5) - hash) + strForHash.charCodeAt(i);
        hash |= 0;
    }
    const seed = Math.abs(hash);

    const fullTitle = sanitizeTitle(titleSubject, 150) || "Creative Stock Graphic";
    const desc = `Professional high quality stock graphic featuring ${titleSubject.toLowerCase()} designed for modern commercial, editorial, and digital media projects.`;

    const subjectKeywords = cleanTitleWords.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    const visualStyles = ["digital art", "illustration", "vector graphic", "3d render", "photo illustration", "graphic design", "creative artwork", "modern visual"];
    const environments = ["isolated background", "minimalist backdrop", "clean composition", "studio shot", "vibrant display", "artistic setting"];
    const moods = ["modern concept", "creative element", "trendy style", "elegant aesthetic", "dynamic composition", "professional look"];
    const technicals = ["high resolution", "sharp details", "commercial quality", "custom design", "editable asset", "stock visual"];

    const pick = (arr, offset) => arr[(seed + offset) % arr.length];

    const dynamicSet = new Set([
        ...subjectKeywords,
        pick(visualStyles, 0),
        pick(visualStyles, 1),
        pick(environments, 2),
        pick(environments, 3),
        pick(moods, 4),
        pick(moods, 5),
        pick(technicals, 6),
        pick(technicals, 7),
        "stock asset",
        "digital graphic",
        "commercial media"
    ]);

    const contextualFillers = [
        "visual composition", "creative design", "modern artwork", "high quality", "banner element",
        "presentation asset", "marketing graphic", "digital creation", "decorative element", "artistic render",
        "concept illustration", "editorial media", "stock photo", "vibrant visual", "clean design", "studio asset"
    ];

    let fillIdx = 0;
    while (dynamicSet.size < Math.max(targetCount, 35) && fillIdx < contextualFillers.length) {
        dynamicSet.add(contextualFillers[(seed + fillIdx) % contextualFillers.length]);
        fillIdx++;
    }

    const finalKeywordsList = Array.from(dynamicSet).join(', ');

    return {
        choices: [
            {
                message: {
                    content: JSON.stringify({
                        title: fullTitle,
                        description: desc,
                        keywords: finalKeywordsList
                    })
                }
            }
        ]
    };
}

function extractCleanSubject(rawSubject) {
    if (!rawSubject) return "a man";
    
    let cleaned = String(rawSubject)
        .replace(/i want to generate (images|photos|prompts)? (of)?/gi, '')
        .replace(/generate (images|photos|prompts)? (of)?/gi, '')
        .replace(/every prompt must be (defferent|different)/gi, '')
        .replace(/in (defferent|different) (angles|positions|poses)/gi, '')
        .replace(/one image include/gi, '')
        .replace(/like images/gi, '')
        .replace(/8k resolution|professional lighting|octane render style/gi, '')
        .replace(/sitting|standing|using mobile/gi, '')
        .replace(/[\s,-]+/g, ' ')
        .trim();

    if (/man|guy|male/i.test(cleaned)) return "a man";
    if (/woman|girl|female/i.test(cleaned)) return "a woman";
    if (/people|person|group/i.test(cleaned)) return "a person";

    const words = cleaned.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0 && words.length <= 4) {
        return words.join(' ');
    }

    return "a man";
}

function generateFallbackPrompts(textPrompt, count = 50) {
    let subject = "a man";
    if (textPrompt) {
        const match = textPrompt.match(/Main Core Subject:\s*(.*)/i) || textPrompt.match(/subject:\s*(.*)/i);
        if (match && match[1]) {
            subject = extractCleanSubject(match[1]);
        } else {
            subject = extractCleanSubject(textPrompt);
        }
    }

    const shotTypes = [
        "A sharp studio photograph of",
        "A full-body studio portrait featuring",
        "An eye-level commercial studio shot of",
        "A medium-shot studio photograph showcasing",
        "A dramatic wide-angle studio capture of",
        "A professional high-key studio photo of",
        "A clean editorial studio portrait of",
        "A dynamic action studio shot depicting",
        "A low-angle studio photograph of",
        "A high-angle studio portrait featuring"
    ];

    const posesAndActions = [
        "standing confidently with arms crossed",
        "sitting comfortably on a minimalist wooden stool",
        "actively using a smartphone with a focused expression",
        "walking casually while holding a mobile phone",
        "leaning casually against a white backdrop looking into the distance",
        "sitting at a modern glass desk interacting with a touchscreen device",
        "looking directly into the camera with an engaging smile",
        "captured in a mid-stride walking pose",
        "sitting cross-legged on the floor checking a digital tablet",
        "standing in a relaxed three-quarter profile pose",
        "holding a smartphone in one hand while making a natural gesture",
        "sitting in an ergonomic office chair looking thoughtful",
        "standing tall with hands in pockets",
        "sitting on the edge of a bench scrolling on a smartphone",
        "leaning forward with a welcoming expression",
        "standing in a dynamic power pose",
        "sitting back in a relaxed posture",
        "holding a mobile device up as if taking a photo",
        "standing side-profile while looking over shoulder",
        "sitting thoughtfully with chin resting on hand"
    ];

    const attires = [
        "wearing a sleek white button-down shirt and tailored trousers",
        "dressed in a minimalist modern beige suit",
        "wearing a clean casual white t-shirt and dark denim",
        "dressed in sharp contemporary business casual attire",
        "wearing an elegant monochrome turtleneck outfit",
        "dressed in a stylish modern casual blazer",
        "wearing a minimalist athletic modern outfit",
        "dressed in a sophisticated smart-casual ensemble"
    ];

    const lightingAndDetails = [
        "isolated against a seamless pure white studio background, 8k resolution, professional diffuse softbox lighting, octane render style.",
        "set against a clean white backdrop, ultra-detailed 8k resolution, cinematic studio lighting with sharp highlights, octane render style.",
        "on a pristine high-key white studio background, sharp focus, 8k resolution, soft rim lighting, professional photography.",
        "isolated on a bright seamless white background, crisp 8k details, master studio light setup, octane render style.",
        "against a minimalist white backdrop, high-resolution 8k photography, professional studio key light, pristine rendering."
    ];

    const prompts = [];
    for (let i = 0; i < count; i++) {
        const shot = shotTypes[i % shotTypes.length];
        const pose = posesAndActions[i % posesAndActions.length];
        const attire = attires[i % attires.length];
        const light = lightingAndDetails[i % lightingAndDetails.length];

        let promptText = `${shot} ${subject} ${pose}, ${attire}, ${light}`;
        prompts.push(`${i + 1}. ${promptText}`);
    }

    return {
        choices: [
            {
                message: {
                    content: prompts.join('\n')
                }
            }
        ]
    };
}

async function executeVisionPipeline({ apiKey, model, messages, temperature, textPrompt, mimeType, base64Data, response_format, isJson }) {
    let keysToTry = [];

    let shouldExpectJson = true;
    if (typeof isJson === "boolean") {
        shouldExpectJson = isJson;
    } else if (response_format && response_format.type === "json_object") {
        shouldExpectJson = true;
    } else if (response_format === false || response_format === null) {
        shouldExpectJson = false;
    } else if (textPrompt && (textPrompt.includes("Do NOT provide code blocks or JSON") || textPrompt.includes("raw text strings"))) {
        shouldExpectJson = false;
    }

    console.log(`[VisionPipeline] Pipeline initialized. User API key provided: ${apiKey ? (apiKey === "DesignInk_Internal" ? "Internal Default" : "User Custom Key (" + apiKey.substring(0, 6) + "...)") : "None"} | Expect JSON: ${shouldExpectJson}`);

    // 1. User-provided key from UI (if valid and not cooling down)
    if (apiKey && apiKey !== "DesignInk_Internal" && typeof apiKey === "string" && apiKey.trim().length > 5) {
        const userKey = apiKey.trim();
        if (!isKeyInCooldown(userKey)) {
            keysToTry.push({ id: 'user_provided', key: userKey });
        }
    }

    // 2. Load keys from Environment Variables (Gemini -> OpenRouter -> GitHub -> Groq)
    const geminiEnvKeys = getEnvKeys("GEMINI_API_KEYS");
    geminiEnvKeys.forEach((key, idx) => {
        if (!isKeyInCooldown(key) && !keysToTry.some(k => k.key === key)) {
            keysToTry.push({ id: `env_gemini_${idx+1}`, key, provider: 'gemini' });
        }
    });

    const openRouterEnvKeys = getEnvKeys("OPENROUTER_API_KEYS");
    openRouterEnvKeys.forEach((key, idx) => {
        if (!isKeyInCooldown(key) && !keysToTry.some(k => k.key === key)) {
            keysToTry.push({ id: `env_openrouter_${idx+1}`, key, provider: 'openrouter' });
        }
    });

    const gitHubEnvKeys = getEnvKeys("GITHUB_MODELS_API_KEYS");
    gitHubEnvKeys.forEach((key, idx) => {
        if (!isKeyInCooldown(key) && !keysToTry.some(k => k.key === key)) {
            keysToTry.push({ id: `env_github_${idx+1}`, key, provider: 'github' });
        }
    });

    const groqEnvKeys = getEnvKeys("GROQ_API_KEYS");
    groqEnvKeys.forEach((key, idx) => {
        if (!isKeyInCooldown(key) && !keysToTry.some(k => k.key === key)) {
            keysToTry.push({ id: `env_groq_${idx+1}`, key, provider: 'groq' });
        }
    });

    console.log(`[VisionPipeline] Total candidate keys available: ${keysToTry.length}`);

    let lastErrorMessage = "";

    if (keysToTry.length === 0) {
        console.error("[VisionPipeline Warning] Zero candidate API keys available! Set GEMINI_API_KEYS or OPENROUTER_API_KEYS in Vercel environment variables.");
    }

    for (const keyObj of keysToTry) {
        const trimmedKey = keyObj.key;
        if (!trimmedKey || isKeyInCooldown(trimmedKey)) continue;

        let provider = keyObj.provider;
        if (!provider) {
            if (trimmedKey.startsWith("gsk_")) provider = 'groq';
            else if (trimmedKey.startsWith("sk-or-")) provider = 'openrouter';
            else if (trimmedKey.startsWith("ghp_") || trimmedKey.startsWith("github_pat_") || trimmedKey.startsWith("gho_")) provider = 'github';
            else if (trimmedKey.startsWith("AIza") || trimmedKey.startsWith("AQ") || (model && model.toLowerCase().includes("gemini"))) provider = 'gemini';
            else provider = 'gemini';
        }

        console.log(`[VisionPipeline] Attempting key candidate '${keyObj.id}' (${trimmedKey.substring(0, 6)}...) -> Provider: [${provider.toUpperCase()}]`);

        let result;
        if (provider === 'gemini') {
            result = await callNativeGemini(trimmedKey, textPrompt, mimeType, base64Data, temperature, model, shouldExpectJson);
        } else if (provider === 'openrouter') {
            result = await callOpenRouterWithFallback(trimmedKey, messages, temperature, model, shouldExpectJson);
        } else if (provider === 'github') {
            result = await callGitHubModels(trimmedKey, messages, temperature, model, shouldExpectJson);
        } else {
            result = await callGroqWithFallback(trimmedKey, messages, temperature, model, shouldExpectJson);
        }

        if (result.ok) {
            console.log(`[VisionPipeline] SUCCESS via key candidate '${keyObj.id}'!`);
            return { ok: true, data: result.data, keyId: keyObj.id };
        }

        lastErrorMessage = result.error || lastErrorMessage;

        // On Rate Limit (429) or Account Suspension (403), place key on in-memory cooldown
        if (result.status === 429 || result.status === 403 || result.isAccountSuspended) {
            markKeyCooldown(trimmedKey, 300000); // 5 minute cooldown
        }
    }

    // Try free Pollinations AI Vision provider if keys failed or were missing
    if (base64Data) {
        console.log("[VisionPipeline] Attempting free Pollinations AI Vision provider fallback...");
        const pollinationsRes = await callPollinationsVision(textPrompt, mimeType, base64Data, shouldExpectJson);
        if (pollinationsRes.ok) {
            console.log("[VisionPipeline] SUCCESS via Pollinations AI Vision!");
            return { ok: true, data: pollinationsRes.data, keyId: 'pollinations_free' };
        }
        lastErrorMessage = pollinationsRes.error || lastErrorMessage;
    }

    // Dynamic Seed-Varied Fallback generation if no Vision AI call succeeded
    console.error(`[VisionPipeline Fallback] ALL Vision AI providers failed. Returning dynamic fallback. Last error: ${lastErrorMessage || "No keys available"}`);
    return {
        ok: true,
        data: shouldExpectJson ? generateFallbackMetadata(textPrompt, base64Data) : generateFallbackPrompts(textPrompt),
        fallback: true,
        isFallback: true,
        errorType: "ALL_PROVIDERS_FAILED",
        details: lastErrorMessage || "All AI providers failed"
    };
}

const handleGroqProxy = async (req, res) => {
    const payload = req.body?.data || req.body;
    const { apiKey, model, messages, temperature, response_format, isJson } = payload || {};

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Missing or invalid messages array" });
    }

    const { textPrompt, mimeType, base64Data } = parseUserMessagePayload(messages);

    const pipelineRes = await executeVisionPipeline({
        apiKey,
        model,
        messages,
        temperature,
        textPrompt,
        mimeType,
        base64Data,
        response_format,
        isJson
    });

    if (pipelineRes.ok) {
        return res.json(req.body?.data ? { result: pipelineRes.data } : pipelineRes.data);
    }

    return res.status(pipelineRes.status || 500).json({ error: pipelineRes.error });
};

app.post("/api/groqProxy", handleGroqProxy);
app.post("/groqProxy", handleGroqProxy);
app.post("/", handleGroqProxy);

// Handler for generateMetadata API
app.post("/api/generateMetadata", async (req, res) => {
    try {
        const { imageBase64 } = req.body || {};
        if (!imageBase64) {
            return res.status(400).json({ error: "Missing required field: imageBase64" });
        }

        let rawBase64 = imageBase64;
        let mimeType = "image/jpeg";
        if (imageBase64.includes(";base64,")) {
            const parts = imageBase64.split(";base64,");
            mimeType = parts[0].replace("data:", "") || "image/jpeg";
            rawBase64 = parts[1];
        }

        const visionPrompt = `You are an expert Adobe Stock metadata generator. Analyze the provided image in detail and generate accurate stock photo metadata.
Respond ONLY with a valid JSON object in this exact structure without backticks:
{
  "title": "...",
  "description": "...",
  "keywords": "k1, k2, k3"
}`;

        const messages = [
            {
                role: "user",
                content: [
                    { type: "text", text: visionPrompt },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${rawBase64}` } }
                ]
            }
        ];

        const pipelineRes = await executeVisionPipeline({
            apiKey: "DesignInk_Internal",
            model: "llama-3.2-11b-vision-instruct",
            messages,
            temperature: 0.4,
            textPrompt: visionPrompt,
            mimeType,
            base64Data: rawBase64
        });

        if (!pipelineRes.ok) {
            return res.status(502).json({ error: pipelineRes.error });
        }

        const resultText = pipelineRes.data?.choices?.[0]?.message?.content || "";
        let parsedMetadata = null;
        if (resultText) {
            try {
                parsedMetadata = JSON.parse(resultText.replace(/```json/gi, '').replace(/```/g, '').trim());
            } catch (e) {}
        }

        return res.json({ status: "success", metadata: parsedMetadata });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Save API Key Handler
app.post("/api/saveGroqApiKey", async (req, res) => {
    const payload = req.body?.data || req.body;
    const { key, type } = payload || {};
    if (!key || typeof key !== 'string') return res.json({ result: { success: false } });

    try {
        const db = admin.firestore();
        const existingSnap = await db.collection('api_keys_pool').where('key', '==', key.trim()).get();
        if (existingSnap.empty) {
            await db.collection('api_keys_pool').add({
                key: key.trim(),
                api_key: key.trim(),
                type: type || "Vision Metadata Multi-AI",
                status: "active",
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        return res.json(req.body?.data ? { result: { success: true } } : { success: true });
    } catch (e) {
        return res.json(req.body?.data ? { result: { success: false, error: e.message } } : { success: false, error: e.message });
    }
});

if (require.main === module) {
    const path = require("path");
    const PORT = process.env.PORT || 3000;
    app.use(express.static(path.join(__dirname, "../public")));
    app.listen(PORT, () => {
        console.log(`DesignInk Creative Suite server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
