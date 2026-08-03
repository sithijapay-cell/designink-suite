const admin = require("firebase-admin");
const serviceAccount = require("../../../Downloads/serviceAccountKey.json"); // Assuming they might have it, or standard ADC

admin.initializeApp();
const db = admin.firestore();
async function test() {
    const snap = await db.collection("api_keys_pool").limit(1).get();
    if(snap.empty) { console.log("Empty"); return; }
    const doc = snap.docs[0].data();
    console.log("Encrypted key:", doc.api_key || doc.key);
}
test();
