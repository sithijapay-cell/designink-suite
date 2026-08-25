const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const ytdl = require("@distube/ytdl-core");

admin.initializeApp();

// --- Security Helpers ---
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
        
        if (/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(text)) {
             const decoded = Buffer.from(text, 'base64').toString('utf8');
             if (!/[\x00-\x08\x0E-\x1F]/.test(decoded)) return decoded;
        }
        return text;
    } catch (e) {
        return text;
    }
}


// We don't use a secret here because the USER provides their own API key
// sent in the request body — we just forward it safely server-side.

// Global Round-Robin State
let currentKeyIndex = 0;

/**
 * Helper to log tool usage activities
 */
async function logActivity(type, context) {
    try {
        const db = admin.firestore();
        await db.collection('usage_logs').add({
            type,
            ...context,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("Activity logging failed:", e);
    }
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
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
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
                        temperature: temperature ?? 0.4,
                        maxOutputTokens: 2048
                    }
                })
            });

            const data = await res.json();
            if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                let generatedContent = data.candidates[0].content.parts[0].text;
                generatedContent = generatedContent.replace(/```json/gi, '').replace(/```/g, '').trim();
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
            if (res.status === 400 && data.error?.message?.toLowerCase().includes("key")) {
                return { ok: false, error: "Invalid API Key", status: 401 };
            }
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
                    temperature: temperature ?? 0.4,
                    max_tokens: 2048,
                    response_format: { type: "json_object" }
                })
            });

            const data = await res.json();
            if (res.ok && data.choices?.[0]?.message?.content) {
                let content = data.choices[0].message.content;
                content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
                data.choices[0].message.content = content;
                return { ok: true, data };
            }
            lastStatus = res.status;
            lastErr = data.error?.message || `OpenRouter ${model} error ${res.status}`;
            if (res.status === 401 || data.error?.message?.toLowerCase().includes("key") || data.error?.message?.toLowerCase().includes("unauthorized")) {
                return { ok: false, error: "Invalid API Key", status: 401 };
            }
        } catch (e) {
            lastErr = e.message;
        }
    }

    return { ok: false, error: lastErr, status: lastStatus };
}

async function callGroqWithFallback(apiKey, messages, temperature, requestedModel) {
    // Pass full messages array (including image_url) unchanged to Groq without text stripping hacks.
    const activeGroqModels = [
        "llama-3.2-11b-vision-instruct",
        "llama-3.2-90b-vision-preview",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant"
    ];

    if (requestedModel && !activeGroqModels.includes(requestedModel) && !requestedModel.includes('/')) {
        activeGroqModels.unshift(requestedModel);
    }

    let lastErr = null;
    let lastStatus = 500;

    for (const model of activeGroqModels) {
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
                    temperature: temperature ?? 0.4,
                    max_tokens: 2048,
                    response_format: { type: "json_object" }
                })
            });

            const data = await res.json();
            if (res.ok && data.choices?.[0]?.message?.content) {
                let content = data.choices[0].message.content;
                content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
                data.choices[0].message.content = content;
                return { ok: true, data };
            }
            lastStatus = res.status;
            lastErr = data.error?.message || `Groq ${model} error ${res.status}`;
            if (res.status === 401 || data.error?.message?.toLowerCase().includes("invalid api key")) {
                return { ok: false, error: "Invalid API Key", status: 401 };
            }
        } catch (e) {
            lastErr = e.message;
        }
    }

    return { ok: false, error: lastErr, status: lastStatus };
}

async function callGitHubModels(apiKey, messages, temperature) {
    const models = [
        "gpt-4o-mini",
        "gpt-4o",
        "meta-llama-3.1-70b-instruct",
        "Llama-3.2-11B-Vision-Instruct"
    ];
    let lastErr = null;

    for (const model of models) {
        try {
            const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: temperature ?? 0.5,
                    max_tokens: 2048,
                    response_format: { type: "json_object" }
                })
            });

            const data = await res.json();
            if (res.ok && data.choices?.[0]?.message?.content) {
                return { ok: true, data };
            }
            lastErr = data.error?.message || `GitHub Models ${model} ${res.status}`;
            if (res.status === 401 || data.error?.message?.toLowerCase().includes("unauthorized") || data.error?.message?.toLowerCase().includes("invalid api key")) {
                return { ok: false, error: "Invalid API Key", status: 401 };
            }
        } catch (e) {
            lastErr = e.message;
        }
    }

    return { ok: false, error: lastErr, status: 500 };
}

function generateFallbackMetadata(textPrompt) {
    let filenameHint = "";
    let targetCount = 45;
    if (textPrompt) {
        const match = textPrompt.match(/Filename \/ Topic Hint:\s*"([^"]+)"/i) || textPrompt.match(/topic hint:\s*"([^"]+)"/i);
        if (match) filenameHint = match[1];
        const countMatch = textPrompt.match(/Generate exactly (\d+)/i) || textPrompt.match(/(\d+)\s+keywords/i);
        if (countMatch && countMatch[1]) targetCount = parseInt(countMatch[1], 10);
    }

    const rawName = filenameHint.substring(0, filenameHint.lastIndexOf('.')) || filenameHint || "Stock Photo Illustration";
    const cleanTitle = rawName
        .replace(/_\d+K|\d{8,}/gi, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const title = cleanTitle ? cleanTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : "Stock Photo Creative Design";
    const desc = `High quality stock illustration featuring ${title.toLowerCase()} in high resolution digital rendering suitable for commercial and creative projects.`;
    
    const baseWords = cleanTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const standardStockTerms = [
        'stock photo', 'digital art', 'illustration', 'background', 'design', 'graphic', 'isolated', 'high quality',
        'vector', 'concept', 'modern', 'wallpaper', 'creative', 'element', 'banner', 'pattern', 'texture', 'symbol',
        'abstract', 'artistic', 'backdrop', 'decor', 'decorative', 'style', 'color', 'bright', 'vibrant', 'light',
        'render', '3d', 'template', 'presentation', 'business', 'marketing', 'commercial', 'media', 'creative art',
        'digital creation', 'sharp details', 'high resolution', 'stock graphic', 'visual', 'artwork', 'trendy design'
    ];

    const keywordsSet = new Set([...baseWords, ...standardStockTerms]);
    const finalKeywordsList = Array.from(keywordsSet).slice(0, Math.max(targetCount, 45)).join(', ');

    return {
        choices: [
            {
                message: {
                    content: JSON.stringify({
                        title: title,
                        description: desc,
                        keywords: finalKeywordsList
                    })
                }
            }
        ]
    };
}

async function executeVisionPipeline({ apiKey, model, messages, temperature, textPrompt, mimeType, base64Data }) {
    const db = admin.firestore();
    
    let poolKeys = [];
    try {
        const keysSnap = await db.collection('api_keys_pool').where('status', 'in', ['active', 'cooldown']).get();
        const now = Date.now();
        
        keysSnap.forEach(doc => {
            const data = doc.data();
            if (data.status === 'active') {
                poolKeys.push({ id: doc.id, key: data.api_key || data.key });
            } else if (data.status === 'cooldown' && data.cooldownUntil && data.cooldownUntil < now) {
                poolKeys.push({ id: doc.id, key: data.api_key || data.key });
                doc.ref.update({ status: 'active', cooldownUntil: admin.firestore.FieldValue.delete() }).catch(()=>{});
            }
        });
    } catch(e) {}
    
    if (apiKey && apiKey !== "DesignInk_Internal") {
        const isDuplicate = poolKeys.some(pk => pk.key === apiKey);
        if (!isDuplicate) {
            poolKeys.unshift({ id: 'user_provided', key: apiKey });
        }
    }

    if (poolKeys.length > 0) {
        let attempts = 0;
        const maxTotalAttempts = Math.min(poolKeys.length * 2, 10);
        let lastErrorMessage = "All providers failed";

        while (attempts < maxTotalAttempts) {
            let selectedKeyObj = poolKeys[currentKeyIndex % poolKeys.length];
            currentKeyIndex++;
            const trimmedKey = selectedKeyObj.key ? selectedKeyObj.key.trim() : "";

            console.log(`[VisionPipeline CloudFunction] Attempting key candidate '${selectedKeyObj.id}' (${trimmedKey.substring(0, 6)}...)...`);

            let provider = 'gemini';
            if (trimmedKey.startsWith("gsk_")) {
                provider = 'groq';
            } else if (trimmedKey.startsWith("sk-or-")) {
                provider = 'openrouter';
            } else if (trimmedKey.startsWith("ghp_") || trimmedKey.startsWith("github_pat_") || trimmedKey.startsWith("gho_")) {
                provider = 'github';
            } else if (trimmedKey.startsWith("AIza") || trimmedKey.startsWith("AQ") || (model && model.toLowerCase().includes("gemini")) || (model && model.toLowerCase().includes("google"))) {
                provider = 'gemini';
            } else if (model && (model.toLowerCase().includes("llama") || model.toLowerCase().includes("mixtral"))) {
                provider = 'groq';
            }

            console.log(`[VisionPipeline CloudFunction] Routing key candidate '${selectedKeyObj.id}' (${trimmedKey.substring(0, 6)}...) to provider: [${provider.toUpperCase()}]`);

            let result;
            if (provider === 'gemini') {
                result = await callNativeGemini(trimmedKey, textPrompt, mimeType, base64Data, temperature);
            } else if (provider === 'openrouter') {
                result = await callOpenRouterWithFallback(trimmedKey, messages, temperature);
            } else if (provider === 'github') {
                result = await callGitHubModels(trimmedKey, messages, temperature);
            } else {
                result = await callGroqWithFallback(trimmedKey, messages, temperature, model);
            }

            if (result.ok) {
                console.log(`[VisionPipeline CloudFunction] SUCCESS via key candidate '${selectedKeyObj.id}'!`);
                db.collection('api_metrics').doc('global').set({
                    totalRequestsProcessed: admin.firestore.FieldValue.increment(1)
                }, { merge: true }).catch(()=>{});

                logActivity("AI_PROMETADATA", {
                    status: "success",
                    keyId: selectedKeyObj.id,
                    user: apiKey === "DesignInk_Internal" ? "Admin" : "Standard"
                }).catch(()=>{});

                return { ok: true, data: result.data, keyId: selectedKeyObj.id };
            }

            lastErrorMessage = result.error || "AI call failed";
            console.error(`[VisionPipeline CloudFunction Error] Candidate '${selectedKeyObj.id}' failed:`, lastErrorMessage);

            if (result.status === 401 && selectedKeyObj.id !== 'user_provided') {
                await db.collection('api_keys_pool').doc(selectedKeyObj.id).update({ status: 'invalid' }).catch(()=>{});
            } else if (result.status === 429 && selectedKeyObj.id !== 'user_provided') {
                await db.collection('api_keys_pool').doc(selectedKeyObj.id).update({
                    cooldownUntil: Date.now() + 20000, 
                    status: 'cooldown'
                }).catch(()=>{});
                await new Promise(r => setTimeout(r, 1000));
            }

            attempts++;
        }
    }

    if (base64Data) {
        console.log("[VisionPipeline CloudFunction] Primary keys failed. Attempting Moondream2 backup...");
        const moondreamRes = await callMoondream(textPrompt, base64Data);
        if (moondreamRes.ok) {
            console.log("[VisionPipeline CloudFunction] SUCCESS via Moondream2 ZeroGPU microservice!");
            return { ok: true, data: moondreamRes.data, isMoondream: true };
        }
    }

    console.error("[VisionPipeline CloudFunction Fallback] ALL vision providers failed. Returning dummy metadata fallback.");
    return {
        ok: true,
        data: generateFallbackMetadata(textPrompt),
        fallback: true,
        isFallback: true,
        errorType: "ALL_PROVIDERS_FAILED",
        details: "All vision AI providers failed"
    };
}

exports.groqProxy = onCall(
  {
    cors: true,
    timeoutSeconds: 120,
    memory: "1GiB",
    invoker: "public",
  },
  async (request) => {
    console.log("MultiAI groqProxy called with model:", request.data.model);
    const { apiKey, model, messages, temperature } = request.data;

    if (!messages || !Array.isArray(messages)) {
      throw new HttpsError("invalid-argument", "Missing or invalid messages array");
    }

    const { textPrompt, mimeType, base64Data } = parseUserMessagePayload(messages);

    try {
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
        return pipelineRes.data;
      }

      throw new HttpsError("resource-exhausted", `AI Provider Error: ${pipelineRes.error}`);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("MultiAI proxy error:", err);
      throw new HttpsError("internal", err.message);
    }
  }
);

// --- PayHere Secure Integration ---
const PAYHERE_MERCHANT_ID = "1234901";
const PAYHERE_SECRET = "MTc3NjY3MjkzNDUxMzMwMjk2MTM4Nzc1MDcwMTAxNzM1NjQ4OA==";

// 1. Generate MD5 Hash securely for Frontend
exports.generatePayhereHash = onCall(
  { cors: true },
  (request) => {
    try {
      const { orderId, amount, currency } = request.data;
      if (!orderId || !amount || !currency) {
        throw new HttpsError("invalid-argument", "Missing payment parameters");
      }
      
      const hashedSecret = crypto.createHash('md5').update(PAYHERE_SECRET).digest('hex').toUpperCase();
      const amountStr = parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, '');
      const hashString = PAYHERE_MERCHANT_ID + orderId + amountStr + currency + hashedSecret;
      const finalHash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

      return { hash: finalHash, merchantId: PAYHERE_MERCHANT_ID };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error("Hash generation error:", e);
      throw new HttpsError("internal", e.message || "Hash generation failed");
    }
  }
);

// 2. Webhook for PayHere Notify URL (update Firestore)
exports.payhereNotify = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const {
    merchant_id,
    order_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig,
    custom_1 // We pass user UID via custom_1 from frontend
  } = req.body;

  // Verify MD5 array
  const hashedSecret = crypto.createHash('md5').update(PAYHERE_SECRET).digest('hex').toUpperCase();
  const verifyString = merchant_id + order_id + payhere_amount + payhere_currency + status_code + hashedSecret;
  const computedSig = crypto.createHash('md5').update(verifyString).digest('hex').toUpperCase();

  if (computedSig !== md5sig) {
    console.error("Invalid MD5 Signature");
    res.status(400).send("Invalid Signature");
    return;
  }

  if (status_code === "2") {
    console.log(`Payment success for order ${order_id}, User: ${custom_1}`);
    if (custom_1) {
      // Update Firestore "Purchased" status
      try {
        const db = admin.firestore();
        await db.collection('users').doc(custom_1).collection('purchases').doc(order_id).set({
          orderId: order_id,
          amount: payhere_amount,
          currency: payhere_currency,
          status: "success",
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
      } catch(err) {
        console.error("Firestore update failed:", err);
      }
    }
  }

  res.status(200).send("OK");
});

// =============================================================================
// YTDL ENGINE — Uses @distube/ytdl-core, built for server-side YouTube.
// =============================================================================
async function fetchWithTimeout(url, options = {}, timeout = 25000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

function extractYouTubeId(url) {
    try {
        const u = new URL(url);
        if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
        if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
        return null;
    } catch(e) { return null; }
}

function normalizeVideoUrl(url) {
    try {
        const u = new URL(url);
        if (u.hostname === 'youtu.be') {
            return `https://www.youtube.com/watch?v=${u.pathname.slice(1).split('?')[0]}`;
        }
        if (u.hostname.includes('tiktok.com')) {
            return `${u.protocol}//${u.hostname}${u.pathname}`;
        }
        return url;
    } catch(e) { return url; }
}

/**
 * YouTube extraction using @distube/ytdl-core.
 * This package is specifically designed for server-side YouTube downloading.
 * It handles all InnerTube negotiation, cipher decryption, and format selection.
 */
async function getYouTubeStream(videoUrl, format, quality) {
    const info = await ytdl.getInfo(videoUrl, {
        requestOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        }
    });

    const videoTitle = info.videoDetails.title || "YouTube_Video";
    const qualityNum = parseInt(quality) || 1080;

    if (format === 'mp3') {
        // Audio only
        const audioFormat = ytdl.chooseFormat(info.formats, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });
        if (audioFormat?.url) return { url: audioFormat.url, title: videoTitle };
        throw new Error("No audio format found");
    }

    // Try to get a combined (video+audio) format first
    try {
        const combined = ytdl.chooseFormat(info.formats, {
            quality: qualityNum >= 1080 ? 'highestvideo' : `${qualityNum}p`,
            filter: f => f.hasVideo && f.hasAudio && f.container === 'mp4'
        });
        if (combined?.url) return { url: combined.url, title: videoTitle };
    } catch(e) { /* no combined format at this quality, fall through */ }

    // Fall back to best available combined mp4
    try {
        const best = ytdl.chooseFormat(info.formats, {
            filter: f => f.hasVideo && f.hasAudio && f.container === 'mp4'
        });
        if (best?.url) return { url: best.url, title: videoTitle };
    } catch(e) { /* fall through */ }

    // Last resort: any video format
    const anyVideo = ytdl.chooseFormat(info.formats, { filter: 'videoandaudio' });
    if (anyVideo?.url) return { url: anyVideo.url, title: videoTitle };

    throw new Error("No usable format found by ytdl");
}


exports.fetchCobaltVideo = onCall({
    maxInstances: 20,
    cors: true,
    timeoutSeconds: 240,
    memory: "512MiB"
}, async (request) => {
    try {
        const { url, format, quality } = request.data;
        if (!url) throw new HttpsError("invalid-argument", "URL is required");

        const targetUrl = normalizeVideoUrl(url);
        const isTikTok = targetUrl.includes("tiktok.com");
        const isYoutube = targetUrl.includes("youtube.com");
        const videoId = extractYouTubeId(targetUrl);

        let streamUrl = null;
        let title = "DesignInk_Media";
        let lastError = "";

        // ===================================================================
        // PHASE 1: YouTube → ytdl-core (server-side dedicated YouTube library)
        // ===================================================================
        if (isYoutube && videoId) {
            try {
                console.log(`[ytdl] Extracting: ${videoId}`);
                const result = await getYouTubeStream(targetUrl, format, quality);
                streamUrl = result.url;
                title = result.title;
                console.log(`[ytdl] ✅ Success: ${title}`);
            } catch(e) {
                lastError = `ytdl: ${e.message}`;
                console.warn(`[ytdl] ❌ Failed: ${e.message}`);
            }
        }

        // ===================================================================
        // PHASE 2: TikTok → TikWM API (Works from all IPs)
        // ===================================================================
        if (!streamUrl && isTikTok) {
            try {
                console.log(`[TikWM] Extracting TikTok...`);
                const tikRes = await fetchWithTimeout(
                    `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`,
                    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } },
                    15000
                );
                const tikData = await tikRes.json();
                if (tikData?.data) {
                    streamUrl = tikData.data.hdplay || tikData.data.play;
                    title = tikData.data.title || "TikTok_Video";
                    console.log(`[TikWM] ✅ Success: ${title}`);
                }
            } catch(e) {
                lastError = `TikWM: ${e.message}`;
                console.warn(`[TikWM] ❌ Failed: ${e.message}`);
            }
        }

        // ===================================================================
        // PHASE 3: Generic/Other platforms → Cobalt (best-effort fallback)
        // ===================================================================
        if (!streamUrl && !isYoutube) {
            const cobaltNodes = [
                "https://api.cobalt.tools",
                "https://cobalt.hyra.bot",
                "https://cobalt.shun.pw"
            ];
            const payload = {
                url: targetUrl,
                videoQuality: quality || "1080",
                videoCodec: "h264",
                downloadMode: format === 'mp3' ? 'audio' : 'video'
            };
            for (const node of cobaltNodes) {
                try {
                    const res = await fetchWithTimeout(node, {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                            "Origin": "https://cobalt.tools"
                        },
                        body: JSON.stringify(payload)
                    }, 20000);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.url) { streamUrl = data.url; title = data.filename || title; break; }
                    }
                } catch(e) { lastError = `Cobalt(${node}): ${e.message}`; }
                if (streamUrl) break;
            }
        }

        if (!streamUrl) {
            throw new HttpsError("unavailable", `All extraction methods failed. Last: ${lastError}`);
        }

        logActivity("VIDEO_EXTRACT", {
            type: isTikTok ? 'tiktok' : (isYoutube ? 'youtube' : 'other'),
            status: "success",
            provider: isYoutube ? 'ytdl' : (isTikTok ? 'tikwm' : 'cobalt')
        }).catch(() => {});


        return {
            status: "success",
            url: `/proxyDownload?url=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(title)}`,
            title
        };

    } catch (err) {
        if (err instanceof HttpsError) throw err;
        console.error("Engine Failure:", err);
        throw new HttpsError("internal", err.message);
    }
});






/**
 * HiveDown Technology: Universal Streaming Bridge with Range Support
 * Essential for large video files and mobile data saving.
 * 
 * Optimized to handle external sources that block Direct IPs (uses rotation headers).
 */
exports.proxyDownload = onRequest({
    cors: true,
    timeoutSeconds: 300,
    memory: "1GiB"
}, async (req, res) => {
    const { url, title } = req.query;
    if (!url) return res.status(400).send("Extraction missing URL");

    const decodedUrl = decodeURIComponent(url);
    const range = req.headers.range;

    try {
        const fetchHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": decodedUrl.includes("tiktok") ? "https://www.tiktok.com/" : "https://www.youtube.com/",
            "Accept": "*/*",
            "Connection": "keep-alive"
        };

        if (range) {
            fetchHeaders["Range"] = range;
        }

        const response = await fetch(decodedUrl, { 
            headers: fetchHeaders,
            redirect: 'follow'
        });

        if (!response.ok && response.status !== 206) {
            // Fallback for tricky URLs – some mirrors require specific origins
            const retryResponse = await fetch(decodedUrl, {
                headers: { ...fetchHeaders, "Origin": "https://cobalt.tools" }
            });
            if (!retryResponse.ok && retryResponse.status !== 206) {
                throw new Error(`Source stream failed with ${response.status}`);
            }
        }

        // Forward critical headers for "Premium" downloader experience
        const contentType = response.headers.get("content-type") || "video/mp4";
        const contentLength = response.headers.get("content-length");
        const acceptRanges = response.headers.get("accept-ranges") || "bytes";
        const contentRange = response.headers.get("content-range");
        
        const cleanTitle = (title || "DesignInk_Media").replace(/[^a-zA-Z0-9]/g, '_');
        const extension = contentType.includes('audio') ? 'mp3' : 'mp4';
        const filename = `${cleanTitle}.${extension}`;

        const headers = {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Accept-Ranges": acceptRanges,
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
            "X-Content-Type-Options": "nosniff"
        };

        if (contentLength) headers["Content-Length"] = contentLength;
        if (contentRange) headers["Content-Range"] = contentRange;

        res.set(headers);
        res.status(range ? 206 : (response.status === 206 ? 206 : 200));

        if (response.body) {
            const { Readable } = require('stream');
            const nodeStream = Readable.fromWeb(response.body);
            nodeStream.pipe(res);
        } else {
            throw new Error("Empty body from stream source");
        }

    } catch (err) {
        console.error("HiveBridge Error:", err);
        res.status(500).send("Media stream unavailable. (E: HIVE_BRIDGE_FAILURE)");
    }
});


// --- Admin Dashboard Functions ---
async function checkAdmin(request) {
    const uid = request.auth?.uid;
    const email = request.auth?.token?.email || '';
    if (email !== "sithijapay@gmail.com") {
        throw new HttpsError("permission-denied", "Access restricted to sithijapay@gmail.com only.");
    }
    const adminDoc = await admin.firestore().collection('admins').doc(uid).get();
    if (!adminDoc.exists) {
        throw new HttpsError("permission-denied", "You must be an admin to call this function.");
    }
}

// 1. Claim Admin (only works if NO admins exist yet)
exports.claimAdminStatus = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Must be logged in.");
    
    const db = admin.firestore();
    const adminsSnapshot = await db.collection('admins').limit(1).get();
    
    if (!adminsSnapshot.empty) {
        const myAdminDoc = await db.collection('admins').doc(uid).get();
        if (myAdminDoc.exists) return { success: true, message: "You are already admin." };
        throw new HttpsError("already-exists", "An admin is already registered for this platform.");
    }
    
    await db.collection('admins').doc(uid).set({ 
        grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        email: request.auth.token.email || "unknown@admin.com"
    });
    return { success: true, message: "You have claimed the Admin role successfully." };
});

// 2. Get All Dashboard Data
exports.getAdminDashboardData = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Must be logged in.");
    await checkAdmin(request);
    
    const db = admin.firestore();
    
    let allUsers = [];
    let allPurchases = [];
    let totalRevenueLKR = 0;
    
    // Fetch users directly from Firebase Auth (bypassing Firestore rules/collections)
    const listUsersResult = await admin.auth().listUsers(1000);
    const authUsers = listUsersResult.users;
    
    for (const userRecord of authUsers) {
        allUsers.push({
            uid: userRecord.uid,
            email: userRecord.email,
            name: userRecord.displayName || 'Unknown',
            photoURL: userRecord.photoURL || '',
            lastLoginSeconds: new Date(userRecord.metadata.lastSignInTime).getTime() / 1000
        });
        
        // Fetch their purchases
        const purchasesSnap = await db.collection('users').doc(userRecord.uid).collection('purchases').get();
        for (const purchaseDoc of purchasesSnap.docs) {
            const pData = purchaseDoc.data();
            pData.orderId = purchaseDoc.id;
            pData.userEmail = userRecord.email || 'Unknown';
            allPurchases.push(pData);
            
            if (pData.status === "success" || pData.status === "manual") {
                totalRevenueLKR += parseFloat(pData.amount || 0);
            }
        }
    }
    
    // Sort purchases by time descending
    allPurchases.sort((a, b) => {
        const timeA = a.timestamp?._seconds || 0;
        const timeB = b.timestamp?._seconds || 0;
        return timeB - timeA;
    });
    // Fetch harvested API keys AND Load Balancer stats from api_keys_pool
    let harvestedKeys = [];
    let totalKeysInPool = 0;
    let keysOnCooldown = 0;
    const now = Date.now();
    const poolSnap = await db.collection('api_keys_pool').get();
    
    poolSnap.forEach(doc => {
        let docData = doc.data();
        totalKeysInPool++;
        
        if (docData.status === 'cooldown' && docData.cooldownUntil && docData.cooldownUntil > now) {
            keysOnCooldown++;
        }
        
        if (docData.api_key) {
            docData.key = decryptText(docData.api_key);
        } else if (docData.key) { // Legacy fallback
            docData.key = decryptText(docData.key);
        }
        
        harvestedKeys.push(docData);
    });
    
    // Sort keys by time descending
    harvestedKeys.sort((a, b) => {
        const timeA = a.timestamp?._seconds || 0;
        const timeB = b.timestamp?._seconds || 0;
        return timeB - timeA;
    });

    let totalRequestsProcessed = 0;
    const globalMetrics = await db.collection('api_metrics').doc('global').get();
    if (globalMetrics.exists) {
        totalRequestsProcessed = globalMetrics.data().totalRequestsProcessed || 0;
    }

    return {
        users: allUsers,
        purchases: allPurchases,
        totalRevenueLKR: totalRevenueLKR,
        totalSales: allPurchases.length,
        harvestedKeys: harvestedKeys,
        lbStats: {
            totalKeys: totalKeysInPool,
            keysOnCooldown: keysOnCooldown,
            totalRequestsProcessed: totalRequestsProcessed
        }
    };
});

// 2.5 Get usage analytics for AI
exports.getUsageAnalytics = onCall(async (request) => {
    await checkAdmin(request);
    const db = admin.firestore();
    
    // Fetch last 100 logs
    const logsSnap = await db.collection('usage_logs')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
        
    const logs = logsSnap.docs.map(doc => doc.data());
    
    // Summarize
    const summary = {
        total_recent_requests: logs.length,
        tool_counts: {},
        model_distribution: {},
        status_counts: { success: 0, failed: 0 }
    };
    
    logs.forEach(log => {
        summary.tool_counts[log.type] = (summary.tool_counts[log.type] || 0) + 1;
        if (log.model) {
            summary.model_distribution[log.model] = (summary.model_distribution[log.model] || 0) + 1;
        }
        if (log.status === 'success') summary.status_counts.success++;
        else summary.status_counts.failed++;
    });
    
    return summary;
});

// 7. Sync Personal Usage Stats
exports.syncUsageStats = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'User must be logged in.');
    
    const { key, by } = request.data;
    const db = admin.firestore();
    const statsRef = db.collection('users').doc(uid).collection('stats').doc('usage');
    
    await statsRef.set({
        [key]: admin.firestore.FieldValue.increment(by || 1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return { success: true };
});

// 8. Get Personal Usage Stats
exports.getPersonalUsageStats = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'User must be logged in.');
    
    const db = admin.firestore();
    const statsSnap = await db.collection('users').doc(uid).collection('stats').doc('usage').get();
    
    if (!statsSnap.exists) {
        return { success: true, stats: { prompts: 0, filesProcessed: 0, videos: 0, converted: 0 } };
    }
    
    return { success: true, stats: statsSnap.data() };
});
exports.adminGrantToolAccess = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Must be logged in.");
    await checkAdmin(request);
    
    const { targetEmail, toolId } = request.data;
    if (!targetEmail || !toolId) throw new HttpsError("invalid-argument", "Missing parameters.");
    
    const db = admin.firestore();
    let targetUid = null;

    try {
        // Source of truth: Firebase Auth
        const userRecord = await admin.auth().getUserByEmail(targetEmail);
        targetUid = userRecord.uid;
    } catch (e) {
        // Fallback: Check Firestore in case Auth lookup fails for some reason
        const usersSnap = await db.collection('users').where('email', '==', targetEmail).get();
        if (usersSnap.empty) {
            throw new HttpsError("not-found", `User with email ${targetEmail} not found in Auth or Database.`);
        }
        targetUid = usersSnap.docs[0].id;
    }
    
    // Ensure the main user document exists (helps with listing users in dashboard)
    await db.collection('users').doc(targetUid).set({
        email: targetEmail,
        lastAdminGrant: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Grant the tool access
    await db.collection('users').doc(targetUid).collection('purchases').doc(toolId).set({
        orderId: toolId,
        amount: "0.00",
        currency: "LKR",
        status: "manual",
        grantedByAdmin: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return { success: true, message: `Access granted to ${targetEmail} for ${toolId}` };
});

// 4. Save API Key to Central Pool (Harvesting / Shared Pool)
exports.saveGroqApiKey = onCall(async (request) => {
    const { key, type } = request.data;
    if (!key || typeof key !== 'string') return { success: false };
    
    const trimmedKey = key.trim();
    if (trimmedKey.length < 10) return { success: false };

    try {
        const db = admin.firestore();
        const existingSnap = await db.collection('api_keys_pool').where('key', '==', trimmedKey).get();
        
        if (existingSnap.empty) {
            await db.collection('api_keys_pool').add({
                key: trimmedKey,
                api_key: trimmedKey,
                type: type || "Vision Metadata Multi-AI",
                status: "active",
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log("New API Key added to central pool:", trimmedKey.slice(0, 5) + "...");
        }
        return { success: true };
    } catch (e) {
        console.error("Error saving API key to pool:", e);
        return { success: false, error: e.message };
    }
});

const os = require('os');
const fs = require('fs');
const path = require('path');
const busboy = require('busboy');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

async function callGeminiFetch(apiKey, prompt, base64Audio) {
  const models = [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
  ];
  
  let lastError;
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: "audio/mp3", data: base64Audio } },
              { text: prompt }
            ]
          }],
          generationConfig: { 
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });
      
      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 404 || errText.includes("not found") || errText.includes("not supported")) {
          console.warn(`Model ${model} not supported, trying next...`);
          continue;
        }
        throw new Error(`API failed with status ${response.status}: ${errText}`);
      }
      
      const json = await response.json();
      let text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        text = text.replace(/^```json/im, "").replace(/^```/im, "").trim();
        console.log(`Successfully transcribed using model (fetch): ${model}`);
        return text;
      }
    } catch (e) {
      lastError = e;
      console.error(`Fetch error with model ${model}:`, e.message);
    }
  }
  throw new Error(`All Gemini fetch models failed. Last error: ${lastError ? lastError.message : "Unknown"}`);
}

// 9. Transcribe Video (Subtitle Tool Backend)
exports.transcribeVideo = onRequest(
  {
    cors: true,
    timeoutSeconds: 300,
    memory: "2GiB",
  },
  (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const bb = busboy({ headers: req.headers });
    const tmpdir = os.tmpdir();
    
    let videoFilePath = '';
    let audioFilePath = path.join(tmpdir, `audio-${Date.now()}.mp3`);
    let geminiApiKey = process.env.GEMINI_API_KEY || '';
    let language = 'si';
    
    const fileWrites = [];
    
    bb.on('field', (fieldname, val) => {
        if (fieldname === 'geminiApiKey') {
            geminiApiKey = val;
        } else if (fieldname === 'language') {
            language = val;
        }
    });

    bb.on('file', (fieldname, file, info) => {
        const { filename } = info;
        const filepath = path.join(tmpdir, `video-${Date.now()}-${filename}`);
        videoFilePath = filepath;
        
        const writeStream = fs.createWriteStream(filepath);
        file.pipe(writeStream);
        
        const promise = new Promise((resolve, reject) => {
            file.on('end', () => writeStream.end());
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
        fileWrites.push(promise);
    });

    bb.on('finish', async () => {
        try {
            await Promise.all(fileWrites);
            
            if (!videoFilePath) {
                return res.status(400).json({ error: 'No video file provided' });
            }
            if (!geminiApiKey) {
                return res.status(400).json({ error: 'Gemini API Key is required' });
            }

            let duration = 0;
            try {
                duration = await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(videoFilePath, (err, metadata) => {
                        if (err) return reject(err);
                        resolve(metadata.format?.duration || 0);
                    });
                });
            } catch (e) {
                console.warn("Could not probe video duration:", e);
            }

            await new Promise((resolve, reject) => {
                ffmpeg(videoFilePath)
                    .toFormat("mp3")
                    .audioBitrate(128)
                    .on("end", resolve)
                    .on("error", reject)
                    .save(audioFilePath);
            });

            const audioBuffer = fs.readFileSync(audioFilePath);
            const base64Audio = audioBuffer.toString("base64");

            const isEnglish = language === 'en';
            const prompt = isEnglish 
                ? `You are a highly accurate English speech-to-text transcriber. 
Listen to the provided audio file containing English speech.
Transcribe the speech perfectly into native English text.
You MUST return the output EXACTLY as a JSON array where each object represents a single word spoken.
Each object must have the following keys:
- "word": The English word spoken.
- "start": The start time of the word in seconds (e.g., 1.25).
- "end": The end time of the word in seconds (e.g., 1.80).

IMPORTANT: The start and end timestamps must be highly accurate and perfectly aligned with the audio soundwaves.
- Pay close attention to silence at the beginning, between words, and at the end.
- If there is silence at the beginning, do NOT start the first word at 0.00. Start it exactly when the voice begins.
- The timing of each word must represent when that specific word is spoken, with millisecond-level precision. Avoid timing drifts.

DO NOT include any markdown formatting, backticks, or other text. ONLY output the raw JSON array.`
                : `You are a highly accurate Sinhala speech-to-text transcriber. 
Listen to the provided audio file containing Sinhala speech.
Transcribe the speech perfectly into native Sinhala script (සිංහල අකුරු).
You MUST return the output EXACTLY as a JSON array where each object represents a single word spoken.
Each object must have the following keys:
- "word": The Sinhala word spoken.
- "start": The start time of the word in seconds (e.g., 1.25).
- "end": The end time of the word in seconds (e.g., 1.80).

IMPORTANT: The start and end timestamps must be highly accurate and perfectly aligned with the audio soundwaves.
- Pay close attention to silence at the beginning, between words, and at the end.
- If there is silence at the beginning, do NOT start the first word at 0.00. Start it exactly when the voice begins.
- The timing of each word must represent when that specific word is spoken, with millisecond-level precision. Avoid timing drifts.
- If the speaker uses common English words, technical terms, or brand names (such as "video", "download", "link", "computer", "button", "next", etc.) within their Sinhala speech, you MUST write those specific words in English script (English letters) in lowercase. Do NOT spell them phonetically using Sinhala script (e.g., write "video" instead of "වීඩියෝ", and "download" instead of "ඩවුන්ලෝඩ්").

DO NOT include any markdown formatting, backticks, or other text. ONLY output the raw JSON array.`;

            let textOut = "";
            try {
              textOut = await callGeminiFetch(geminiApiKey, prompt, base64Audio);
            } catch (e) {
              throw new Error(e.message);
            }

            let geminiWords = [];
            try {
                geminiWords = JSON.parse(textOut);
            } catch (e) {
                throw new Error("Gemini returned invalid JSON structure.");
            }

            if (!Array.isArray(geminiWords) || geminiWords.length === 0) {
                throw new Error("Gemini returned no speech data.");
            }

            const allWords = [];
            const processedSegments = [];
            
            let currentSegment = { start: 0, end: 0, text: "", words: [] };
            let fullText = "";
            
            geminiWords.forEach((wordObj, idx) => {
                const parsedWord = {
                    word: wordObj.word,
                    start: parseFloat(Number(wordObj.start).toFixed(3)),
                    end: parseFloat(Number(wordObj.end).toFixed(3)),
                };
                allWords.push(parsedWord);
                
                currentSegment.words.push(parsedWord);
                currentSegment.text += (currentSegment.text ? " " : "") + parsedWord.word;
                fullText += (fullText ? " " : "") + parsedWord.word;
                
                currentSegment.end = parsedWord.end;
                if (currentSegment.words.length === 1) currentSegment.start = parsedWord.start;
                
                if (currentSegment.words.length >= 6 || idx === geminiWords.length - 1) {
                    processedSegments.push({
                        id: processedSegments.length,
                        seek: 0,
                        start: currentSegment.start,
                        end: currentSegment.end,
                        text: currentSegment.text,
                        words: [...currentSegment.words],
                        tokens: [],
                        temperature: 0,
                        avg_logprob: 0,
                        compression_ratio: 0,
                        no_speech_prob: 0
                    });
                    currentSegment = { start: 0, end: 0, text: "", words: [] };
                }
            });

            res.json({
                success: true,
                isDemo: false,
                duration: duration || (allWords.length > 0 ? allWords[allWords.length - 1].end + 1 : 0),
                videoUrl: "blob_override_on_client",
                text: fullText,
                segments: processedSegments,
                words: allWords,
            });

        } catch (error) {
            console.error("Transcription error:", error);
            res.status(500).json({ error: error.message || "Transcription failed" });
        } finally {
            try {
                if (videoFilePath && fs.existsSync(videoFilePath)) fs.unlinkSync(videoFilePath);
                if (audioFilePath && fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
            } catch (e) {
                console.error("Cleanup error:", e);
            }
        }
    });

    bb.on('error', (err) => {
        console.error("Busboy error:", err);
        if (!res.headersSent) {
            res.status(400).json({ error: "Failed to parse upload. File might be too large (limit is 32MB) or connection was interrupted." });
        }
    });

    try {
        if (req.rawBody) {
            console.log("RawBody length:", req.rawBody.length, "Content-Length:", req.headers['content-length']);
            bb.end(req.rawBody);
        } else {
            req.pipe(bb);
        }
    } catch (e) {
        console.error("Synchronous Busboy error:", e);
        if (!res.headersSent) {
            res.status(400).json({ error: "Failed to parse upload due to stream error. File might be too large." });
        }
    }
  }
);

// 1. Generate a Signed URL for direct-to-storage upload
exports.generateUploadUrl = onRequest(
  {
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
      const { filename, contentType } = req.body;
      if (!filename || !contentType) {
        return res.status(400).json({ error: 'Missing filename or contentType' });
      }

      const bucket = admin.storage().bucket('designink-metadata-uploads');
      const uniqueFilename = `uploads/video-${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const file = bucket.file(uniqueFilename);

      // Generate a signed URL valid for 1 hour
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 60 * 60 * 1000,
        contentType: contentType,
      });

      res.json({
        success: true,
        uploadUrl: url,
        storageFilePath: uniqueFilename
      });
    } catch (error) {
      console.error("Error generating signed URL:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 2. Process the uploaded video from Firebase Storage
exports.processTranscribeStorage = onRequest(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: "2GiB",
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { storageFilePath, geminiApiKey, language } = req.body;
    if (!storageFilePath || !geminiApiKey) {
      return res.status(400).json({ error: 'Missing storageFilePath or geminiApiKey' });
    }

    const bucket = admin.storage().bucket('designink-metadata-uploads');
    const file = bucket.file(storageFilePath);
    const tmpdir = os.tmpdir();
    
    let isWav = storageFilePath.toLowerCase().endsWith('.wav');
    let videoFilePath = isWav ? '' : path.join(tmpdir, `dl-video-${Date.now()}.mp4`);
    let audioFilePath = path.join(tmpdir, `audio-${Date.now()}.wav`);

    try {
      // 1. Download file from Firebase Storage
      if (isWav) {
        console.log(`Downloading WAV directly: ${storageFilePath} to ${audioFilePath}`);
        await file.download({ destination: audioFilePath });
      } else {
        console.log(`Downloading ${storageFilePath} to ${videoFilePath}`);
        await file.download({ destination: videoFilePath });
      }

      // 2. Probe duration
      let duration = 0;
      try {
        duration = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(isWav ? audioFilePath : videoFilePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format?.duration || 0);
          });
        });
      } catch (e) {
        console.warn("Could not probe duration:", e);
      }

      // 3. Extract Audio via FFmpeg if not WAV
      if (!isWav) {
        console.log(`Extracting audio to ${audioFilePath}`);
        await new Promise((resolve, reject) => {
          ffmpeg(videoFilePath)
            .toFormat("wav")
              .audioFrequency(16000)
              .audioChannels(1)
            .on("end", resolve)
            .on("error", reject)
            .save(audioFilePath);
        });
      }

      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const { GoogleAIFileManager } = require("@google/generative-ai/server");

      const fileManager = new GoogleAIFileManager(geminiApiKey);
      const genAI = new GoogleGenerativeAI(geminiApiKey);

      console.log("Uploading audio to Gemini File API...");
      const uploadResult = await fileManager.uploadFile(audioFilePath, {
        mimeType: "audio/wav",
      });

      console.log(`File uploaded. URI: ${uploadResult.file.uri}`);

      const isEnglish = language === 'en';
      const prompt = isEnglish 
        ? `You are a highly accurate English speech-to-text transcriber. 
Listen to the provided audio file containing English speech.
Transcribe the speech perfectly into native English text.
You MUST return the output EXACTLY as a JSON array where each object represents a single word spoken.
Each object must have the following keys:
- "word": The English word spoken.
- "start": The start time of the word in seconds (e.g., 1.25).
- "end": The end time of the word in seconds (e.g., 1.80).

IMPORTANT: The start and end timestamps must be highly accurate and perfectly aligned with the audio soundwaves.
- Pay close attention to silence at the beginning, between words, and at the end.
- If there is silence at the beginning, do NOT start the first word at 0.00. Start it exactly when the voice begins.
- The timing of each word must represent when that specific word is spoken, with millisecond-level precision. Avoid timing drifts.

DO NOT include any markdown formatting, backticks, or other text. ONLY output the raw JSON array.`
        : `You are a highly accurate Sinhala speech-to-text transcriber. 
Listen to the provided audio file containing Sinhala speech.
Transcribe the speech perfectly into native Sinhala script (සිංහල අකුරු).
You MUST return the output EXACTLY as a JSON array where each object represents a single word spoken.
Each object must have the following keys:
- "word": The Sinhala word spoken.
- "start": The start time of the word in seconds (e.g., 1.25).
- "end": The end time of the word in seconds (e.g., 1.80).

IMPORTANT: The start and end timestamps must be highly accurate and perfectly aligned with the audio soundwaves.
- Pay close attention to silence at the beginning, between words, and at the end.
- If there is silence at the beginning, do NOT start the first word at 0.00. Start it exactly when the voice begins.
- The timing of each word must represent when that specific word is spoken, with millisecond-level precision. Avoid timing drifts.
- If the speaker uses common English words, technical terms, or brand names (such as "video", "download", "link", "computer", "button", "next", etc.) within their Sinhala speech, you MUST write those specific words in English script (English letters) in lowercase. Do NOT spell them phonetically using Sinhala script (e.g., write "video" instead of "වීඩියෝ", and "download" instead of "ඩවුන්ලෝඩ්").

DO NOT include any markdown formatting, backticks, or other text. ONLY output the raw JSON array.`;

      const modelsToTry = [
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash"
      ];

      let result;
      let lastError;
      
      for (const modelName of modelsToTry) {
        console.log(`Trying Gemini model for storage file: ${modelName}...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });
        
        let success = false;
        let retries = 2;
        let delay = 1000;
        
        while (retries > 0) {
          try {
            result = await model.generateContent([
              {
                fileData: {
                  mimeType: uploadResult.file.mimeType,
                  fileUri: uploadResult.file.uri
                }
              },
              { text: prompt }
            ]);
            success = true;
            break;
          } catch (error) {
            lastError = error;
            console.error(`Error with model ${modelName}: ${error.message}`);
            
            if (error.message.includes("404") || error.message.includes("not found") || error.message.includes("not supported")) {
              break;
            }
            
            retries--;
            if (retries > 0) {
              const jitter = Math.floor(Math.random() * 1000);
              const totalDelay = delay + jitter;
              console.log(`Retrying in ${totalDelay}ms (with jitter)...`);
              await new Promise(resolve => setTimeout(resolve, totalDelay));
              delay *= 2;
            }
          }
        }
        
        if (success) {
          console.log(`Successfully transcribed using model: ${modelName}`);
          break;
        }
      }

      if (!result) {
        // Fetch and log available models for debugging
        try {
          const checkRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
          const checkData = await checkRes.json();
          console.warn("API Key models diagnostic check:", JSON.stringify(checkData));
        } catch (checkErr) {
          console.error("Failed to query models list:", checkErr.message);
        }

        throw new Error(`All Gemini models failed. Last error: ${lastError ? lastError.message : "Unknown error"}`);
      }

      const textOut = result.response.text().replace(/^```json/im, "").replace(/^```/im, "").trim();

      let geminiWords = [];
      try {
        geminiWords = JSON.parse(textOut);
      } catch (e) {
        throw new Error("Gemini returned invalid JSON structure.");
      }

      if (!Array.isArray(geminiWords) || geminiWords.length === 0) {
        throw new Error("Gemini returned no speech data.");
      }

      const allWords = [];
      const processedSegments = [];
      
      let currentSegment = { start: 0, end: 0, text: "", words: [] };
      let fullText = "";
      
      geminiWords.forEach((wordObj, idx) => {
        const parsedWord = {
          word: wordObj.word,
          start: parseFloat(Number(wordObj.start).toFixed(3)),
          end: parseFloat(Number(wordObj.end).toFixed(3)),
        };
        allWords.push(parsedWord);
        
        currentSegment.words.push(parsedWord);
        currentSegment.text += (currentSegment.text ? " " : "") + parsedWord.word;
        fullText += (fullText ? " " : "") + parsedWord.word;
        
        currentSegment.end = parsedWord.end;
        if (currentSegment.words.length === 1) currentSegment.start = parsedWord.start;
        
        if (currentSegment.words.length >= 6 || idx === geminiWords.length - 1) {
          processedSegments.push({
            id: processedSegments.length,
            seek: 0,
            start: currentSegment.start,
            end: currentSegment.end,
            text: currentSegment.text,
            words: [...currentSegment.words],
            tokens: [],
            temperature: 0,
            avg_logprob: 0,
            compression_ratio: 0,
            no_speech_prob: 0
          });
          currentSegment = { start: 0, end: 0, text: "", words: [] };
        }
      });

      console.log("Transcription completed successfully");

      // Cleanup Firebase Storage file on success
      try {
        console.log(`Deleting ${storageFilePath} from Storage (success)...`);
        await file.delete({ ignoreNotFound: true });
      } catch (e) {
        console.error("Cleanup storage file error:", e);
      }

      res.json({
        success: true,
        isDemo: false,
        duration: duration || (allWords.length > 0 ? allWords[allWords.length - 1].end + 1 : 0),
        videoUrl: "blob_override_on_client",
        text: fullText,
        segments: processedSegments,
        words: allWords,
      });

    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({ error: error.message || "Transcription failed" });
    } finally {
      // 5. Cleanup local temp files
      try {
        if (videoFilePath && fs.existsSync(videoFilePath)) fs.unlinkSync(videoFilePath);
        if (audioFilePath && fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
      } catch (e) {
        console.error("Cleanup local files error:", e);
      }
    }
  }
);

exports.checkGeminiModels = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      const apiKey = req.query.key || req.body.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "Missing API Key" });
      }
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await response.json();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// --- Hugging Face Moondream2 24/7 Vision AI Cloud Function ---
exports.generateMetadata = onRequest(
  {
    cors: true,
    timeoutSeconds: 300,
    memory: "1GiB",
    invoker: "public",
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed. Use POST." });
    }

    try {
      const { imageBase64, filename } = req.body || {};
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

      const visionPrompt = `You are an expert Adobe Stock metadata generator. Analyze the provided image in detail and generate accurate, high-quality, commercial stock metadata.

Rules:
1. title: A concise, highly descriptive SEO title (50 to 150 characters). Do NOT include file extensions or commas.
2. description: A 1-2 sentence detailed description summarizing the visual scene, subject, lighting, and composition.
3. alt_text: A concise accessibility description for screen readers.
4. keywords: A comma-separated string containing AT LEAST 35 to 50 highly relevant keywords. Include literal visual elements (subject, colors, objects, background) and conceptual themes (mood, concept, style, usage). Order strictly by relevance. Do NOT use single quotes.

Respond ONLY with a valid JSON object in this exact structure without markdown backticks:
{
  "title": "...",
  "description": "...",
  "alt_text": "...",
  "keywords": "k1, k2, k3, ..."
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
        model: "qwen/qwen3.6-27b",
        messages,
        temperature: 0.4,
        textPrompt: visionPrompt,
        mimeType,
        base64Data: rawBase64
      });

      if (!pipelineRes.ok) {
        console.error("All AI vision providers failed in generateMetadata:", pipelineRes.error);
        return res.status(502).json({
          error: "All AI providers failed to analyze the image. Please try again or add another API key to the pool."
        });
      }

      const resultText = pipelineRes.data?.choices?.[0]?.message?.content || "";
      let parsedMetadata = null;

      if (resultText) {
        let cleanText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
          parsedMetadata = JSON.parse(cleanText);
        } catch (e) {}

        if (!parsedMetadata) {
          const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              let sanitized = jsonMatch[0].replace(/,\s*([\}\]])/g, '$1');
              parsedMetadata = JSON.parse(sanitized);
            } catch (e) {}
          }
        }
      }

      if (!parsedMetadata || !parsedMetadata.title || !parsedMetadata.description || !parsedMetadata.keywords) {
        console.error("Invalid or empty metadata returned by AI provider:", resultText);
        return res.status(502).json({
          error: "All AI providers failed to analyze the image. Please try again or add another API key to the pool."
        });
      }

      let tagsArray = [];
      if (typeof parsedMetadata.keywords === 'string') {
        tagsArray = parsedMetadata.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      } else if (Array.isArray(parsedMetadata.keywords)) {
        tagsArray = parsedMetadata.keywords.map(k => String(k).trim().toLowerCase()).filter(Boolean);
        parsedMetadata.keywords = tagsArray.join(', ');
      }

      parsedMetadata.tags = tagsArray;

      return res.status(200).json({
        status: "success",
        metadata: parsedMetadata,
        choices: [
          {
            message: {
              content: JSON.stringify(parsedMetadata)
            }
          }
        ]
      });
    } catch (err) {
      console.error("Error in generateMetadata Cloud Function:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// Priority 6: Automated API key health checks for the Firestore pool
exports.checkApiKeyHealth = onSchedule(
  {
    schedule: "every 1 hours",
    timeoutSeconds: 60,
    memory: "512MiB"
  },
  async (event) => {
    console.log("Running scheduled API Key pool health check...");
    const db = admin.firestore();
    try {
      const keysSnap = await db.collection('api_keys_pool').get();
      const now = Date.now();

      for (const doc of keysSnap.docs) {
        const data = doc.data();
        const poolKey = (data.api_key || data.key || "").trim();
        if (!poolKey) continue;

        // Skip keys already flagged as invalid unless manually reset
        if (data.status === 'invalid') continue;

        // Reset cooldown if window passed
        if (data.status === 'cooldown' && data.cooldownUntil && data.cooldownUntil < now) {
          await doc.ref.update({
            status: 'active',
            cooldownUntil: admin.firestore.FieldValue.delete(),
            lastChecked: admin.firestore.FieldValue.serverTimestamp()
          }).catch(()=>{});
          continue;
        }

        // Send a minimal ping test request depending on key format
        let isValid = true;
        try {
          if (poolKey.startsWith("AIza")) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${poolKey}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }] })
            });
            if (res.status === 400 || res.status === 401) {
              const resData = await res.json().catch(()=>({}));
              if (resData.error?.message?.toLowerCase().includes("key")) isValid = false;
            }
          }
        } catch(pingErr) {
          console.warn(`Health ping check failed for key ${doc.id}:`, pingErr.message);
        }

        if (!isValid) {
          console.log(`Marking key ${doc.id} as invalid in Firestore pool.`);
          await doc.ref.update({
            status: 'invalid',
            lastChecked: admin.firestore.FieldValue.serverTimestamp()
          }).catch(()=>{});
        } else {
          await doc.ref.update({
            lastChecked: admin.firestore.FieldValue.serverTimestamp()
          }).catch(()=>{});
        }
      }
      console.log("API Key pool health check completed successfully.");
    } catch(err) {
      console.error("Error in checkApiKeyHealth scheduled task:", err);
    }
  }
);


