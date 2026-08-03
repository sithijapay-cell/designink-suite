const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const crypto = require("crypto");

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Firebase Admin cleanly for Vercel
if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } else {
            admin.initializeApp();
        }
    } catch (e) {
        console.warn("Firebase Admin initialization warning:", e.message);
    }
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "DesignInk_SafeKey_12345678901234";

function encryptText(text) {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        return Buffer.from(text).toString('base64');
    }
}

function decryptText(text) {
    if (!text) return text;
    try {
        if (text.includes(':')) {
            const textParts = text.split(':');
            const iv = Buffer.from(textParts.shift(), 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        }
        return text;
    } catch (e) {
        return text;
    }
}

let currentKeyIndex = 0;

async function logActivity(type, context) {
    try {
        const db = admin.firestore();
        await db.collection('usage_logs').add({
            type,
            ...context,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {}
}

function parseUserMessagePayload(messages) {
    let textPrompt = "Generate stock photo metadata in raw JSON object format with title, description, keywords.";
    let mimeType = "image/jpeg";
    let base64Data = "";

    try {
        if (Array.isArray(messages)) {
            for (const msg of messages) {
                if (Array.isArray(msg.content)) {
                    for (const item of msg.content) {
                        if (item.type === "text" && item.text) {
                            textPrompt = item.text;
                        } else if (item.type === "image_url" && item.image_url?.url) {
                            const dataUrl = item.image_url.url;
                            const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
                            if (match) {
                                mimeType = match[1];
                                base64Data = match[2];
                            }
                        }
                    }
                } else if (typeof msg.content === "string") {
                    textPrompt = msg.content;
                }
            }
        }
    } catch(e) {}

    return { textPrompt, mimeType, base64Data };
}

async function callNativeGemini(apiKey, textPrompt, mimeType, base64Data, temperature) {
    const models = [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-3.5-pro",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash-exp"
    ];
    let lastErr = null;

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [
                            ...(base64Data ? [{ inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }] : []),
                            { text: textPrompt }
                        ]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: temperature ?? 0.5
                    }
                })
            });

            const data = await res.json();
            if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const generatedContent = data.candidates[0].content.parts[0].text;
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
        } catch (e) {
            lastErr = e.message;
        }
    }
    return { ok: false, error: lastErr, status: 400 };
}

async function callOpenRouterWithFallback(apiKey, messages, temperature) {
    const freeModels = [
        "google/gemini-2.0-flash-001",
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.2-11b-vision-instruct:free",
        "qwen/qwen-2.5-vl-72b-instruct:free",
        "qwen/qwen-2-vl-72b-instruct:free",
        "openai/gpt-4o-mini",
        "anthropic/claude-3.5-sonnet"
    ];

    let lastErr = null;
    let lastStatus = 404;

    for (const model of freeModels) {
        try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://designink.ink/"
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: temperature ?? 0.5,
                    response_format: { type: "json_object" }
                })
            });

            const data = await res.json();
            if (res.ok && data.choices?.[0]?.message?.content) {
                return { ok: true, data };
            }
            lastStatus = res.status;
            lastErr = data.error?.message || `OpenRouter ${model} error ${res.status}`;
        } catch (e) {
            lastErr = e.message;
        }
    }

    return { ok: false, error: lastErr, status: lastStatus };
}

async function callGroqWithFallback(apiKey, messages, temperature, requestedModel) {
    const visionModels = [
        "llama-3.2-11b-vision-instruct",
        "llama-3.2-90b-vision-preview",
        "qwen-2.5-vl-72b",
        "llava-v1.5-7b-instruct"
    ];

    if (requestedModel && !visionModels.includes(requestedModel) && !requestedModel.includes('/')) {
        visionModels.unshift(requestedModel);
    }

    let lastErr = null;
    let lastStatus = 500;

    for (const model of visionModels) {
        try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: temperature ?? 0.5,
                    response_format: { type: "json_object" }
                })
            });

            const data = await res.json();
            if (res.ok && data.choices?.[0]?.message?.content) {
                return { ok: true, data };
            }
            lastStatus = res.status;
            lastErr = data.error?.message || `Groq ${model} error ${res.status}`;
        } catch (e) {
            lastErr = e.message;
        }
    }

    const textModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
    const textOnlyMessages = messages.map(msg => {
        if (Array.isArray(msg.content)) {
            const textParts = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
            return { role: msg.role, content: textParts || "Generate stock metadata with title, description, keywords." };
        }
        return msg;
    });

    for (const model of textModels) {
        try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages: textOnlyMessages,
                    temperature: temperature ?? 0.5,
                    response_format: { type: "json_object" }
                })
            });

            const data = await res.json();
            if (res.ok && data.choices?.[0]?.message?.content) {
                return { ok: true, data };
            }
            lastStatus = res.status;
            lastErr = data.error?.message || `Groq ${model} error ${res.status}`;
        } catch (e) {
            lastErr = e.message;
        }
    }

    return { ok: false, error: lastErr, status: lastStatus };
}

async function executeVisionPipeline({ apiKey, model, messages, temperature, textPrompt, mimeType, base64Data }) {
    let poolKeys = [];
    try {
        const db = admin.firestore();
        const keysSnap = await db.collection('api_keys_pool').where('status', 'in', ['active', 'cooldown']).get();
        const now = Date.now();

        keysSnap.forEach(doc => {
            const data = doc.data();
            if (data.status === 'active') {
                poolKeys.push({ id: doc.id, key: data.api_key || data.key });
            } else if (data.status === 'cooldown' && data.cooldownUntil && data.cooldownUntil < now) {
                poolKeys.push({ id: doc.id, key: data.api_key || data.key });
            }
        });
    } catch(e) {}

    if (apiKey && apiKey !== "DesignInk_Internal") {
        const isDuplicate = poolKeys.some(pk => pk.key === apiKey);
        if (!isDuplicate) {
            poolKeys.unshift({ id: 'user_provided', key: apiKey });
        }
    }

    if (poolKeys.length === 0) {
        return { ok: false, error: "No active API keys available in pool.", status: 503 };
    }

    let attempts = 0;
    const maxTotalAttempts = Math.max(poolKeys.length * 3, 10);
    let lastErrorMessage = "All providers failed";

    while (attempts < maxTotalAttempts) {
        let selectedKeyObj = poolKeys[currentKeyIndex % poolKeys.length];
        currentKeyIndex++;
        const trimmedKey = selectedKeyObj.key ? selectedKeyObj.key.trim() : "";

        let result;
        if (trimmedKey.startsWith("AIza")) {
            result = await callNativeGemini(trimmedKey, textPrompt, mimeType, base64Data, temperature);
        } else if (trimmedKey.startsWith("sk-or-")) {
            result = await callOpenRouterWithFallback(trimmedKey, messages, temperature);
        } else {
            result = await callGroqWithFallback(trimmedKey, messages, temperature, model);
        }

        if (result.ok) {
            return { ok: true, data: result.data, keyId: selectedKeyObj.id };
        }

        lastErrorMessage = result.error || "AI call failed";
        attempts++;
    }

    return { ok: false, error: lastErrorMessage, status: 502 };
}

const handleGroqProxy = async (req, res) => {
    const payload = req.body?.data || req.body;
    const { apiKey, model, messages, temperature } = payload || {};

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
        base64Data
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

module.exports = app;
