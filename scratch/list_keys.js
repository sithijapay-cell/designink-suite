const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

async function run() {
    try {
        const snap = await db.collection("api_keys_pool").get();
        if(snap.empty) {
            console.log("No keys in api_keys_pool");
            return;
        }
        for (const doc of snap.docs) {
            const data = doc.data();
            console.log(`Document: ${doc.id}, Status: ${data.status}`);
            const key = data.api_key || data.key;
            if (key) {
                console.log(`Found Key: ${key.slice(0, 8)}...`);
                // Let's call Groq models API with this key
                const response = await fetch("https://api.groq.com/openai/v1/models", {
                    headers: {
                        "Authorization": `Bearer ${key}`
                    }
                });
                const resData = await response.json();
                if (resData.data) {
                    console.log("Supported Groq Models:");
                    console.log(resData.data.map(m => m.id));
                } else {
                    console.log("Error response:", resData);
                }
            }
        }
    } catch(e) {
        console.error("Error:", e);
    }
}
run();
