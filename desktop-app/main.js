const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const express = require('express');

let mainWindow;
let server;
const PORT = 38921;

function startLocalServer() {
    return new Promise((resolve) => {
        try {
            const apiApp = require('./api/index.js');

            // Serve static website files from local public directory
            apiApp.use(express.static(path.join(__dirname, 'public')));

            // Catch-all route to serve index.html
            apiApp.get('*', (req, res, next) => {
                if (req.path.startsWith('/api') || req.path.startsWith('/groqProxy')) return next();
                res.sendFile(path.join(__dirname, 'public/index.html'));
            });

            server = apiApp.listen(PORT, '127.0.0.1', () => {
                console.log(`DesignInk Desktop Server running on http://127.0.0.1:${PORT}`);
                resolve();
            });

            server.on('error', (err) => {
                console.error("Server listen error:", err.message);
                resolve();
            });
        } catch (err) {
            console.error("Failed to start local express server:", err.message);
            resolve();
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 868,
        minWidth: 1024,
        minHeight: 700,
        title: "DesignInk AI Metadata & Stock Automation Suite",
        icon: path.join(__dirname, 'public/icon.png'),
        backgroundColor: '#070a14',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        }
    });

    Menu.setApplicationMenu(null);

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
            return { action: 'allow' };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Try loading local server URL first, fallback to direct file if needed
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`).catch(() => {
        console.warn("Server load URL failed, falling back to direct loadFile...");
        mainWindow.loadFile(path.join(__dirname, 'public/index.html'));
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    await startLocalServer();
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (server) {
        try { server.close(); } catch (e) {}
    }
    if (process.platform !== 'darwin') app.quit();
});
