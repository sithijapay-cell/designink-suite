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

