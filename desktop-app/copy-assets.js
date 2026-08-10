const fs = require('fs');
const path = require('path');

const rootPublic = path.join(__dirname, '../public');
const rootApi = path.join(__dirname, '../api');
const targetPublic = path.join(__dirname, 'public');
const targetApi = path.join(__dirname, 'api');

console.log("Copying assets to desktop-app directory...");

try {
    fs.cpSync(rootPublic, targetPublic, { recursive: true, force: true });
    console.log("Public folder copied successfully.");
} catch (err) {
    console.error("Error copying public folder:", err.message);
}

try {
    fs.cpSync(rootApi, targetApi, { recursive: true, force: true });
    console.log("API folder copied successfully.");
} catch (err) {
    console.error("Error copying API folder:", err.message);
}

// Customize index.html in desktop-app/public to show ONLY the AI Metadata Generator
try {
    const indexPath = path.join(targetPublic, 'index.html');
    if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');

        // Replace brand tagline
        content = content.replace('<p class="brand-tagline">G R A P H I C S</p>', '<p class="brand-tagline">METADATA GENERATOR</p>');

        // Replace navigation menu to keep ONLY AI Metadata Generator
        const navMenuRegex = /<nav class="nav-menu tabs-container"[^>]*>[\s\S]*?<\/nav>/i;
        const dedicatedNav = `<nav class="nav-menu tabs-container" style="margin-top: 2.5rem;">
                <button class="tab-btn active" data-tab="metadataTab"><i class="fas fa-magic"></i> <span class="nav-label">AI Metadata Generator</span></button>
            </nav>
            <style>
                #homeTab, #promptTab, #humanizerTab, #bgRemoverTab, #converterTab, #videoDownloaderTab, #extensionsTab, #auditorTab, #blogTab { display: none !important; }
                #metadataTab { display: block !important; }
                .topbar { display: none !important; }
            </style>`;
        
        content = content.replace(navMenuRegex, dedicatedNav);
        fs.writeFileSync(indexPath, content, 'utf8');
        console.log("Desktop-specific index.html customization applied successfully (AI Metadata Generator Only).");
    }
} catch (err) {
    console.error("Failed to customize index.html for desktop:", err.message);
}

console.log("Asset sync completed.");
