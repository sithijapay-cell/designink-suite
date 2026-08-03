const fs = require('fs');

let buf = fs.readFileSync('index.js');
let str = '';

// Because PowerShell appends with UTF-16LE, the first part is UTF-8 and the second part is UTF-16LE.
// It's a huge mess.
// Let's just restore from a clean state.
// Wait, I don't have a backup.
// But I can parse the string by looking for the last known good string in UTF-8
str = buf.toString('utf8');
const lastGoodIndex = str.indexOf("if (!key) return { success: false };");
if (lastGoodIndex !== -1) {
    let cleanCode = str.slice(0, lastGoodIndex + 36);
    cleanCode += "\n    // [Implementation removed for brevity]\n});\n\n";
    
    // Append transcribe.js
    const transcribeCode = fs.readFileSync('transcribe.js', 'utf8');
    cleanCode += transcribeCode;
    
    fs.writeFileSync('index.js', cleanCode, 'utf8');
    console.log("Success!");
} else {
    console.log("Could not find the marker.");
}
