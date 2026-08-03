const { GoogleGenerativeAI } = require("@google/generative-ai");

async function checkModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Wait, listModels is not in the genAI object usually, we have to fetch it or check if it exists
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
    } catch (e) {
        console.error(e);
    }
}
checkModels();
