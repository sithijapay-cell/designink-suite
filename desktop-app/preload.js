const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('isElectronDesktop', true);
