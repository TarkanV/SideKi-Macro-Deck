const { app, BrowserWindow, globalShortcut } = require('electron')
const path = require('path');
const fs = require('fs').promises;
const { exec, spawn } = require('child_process');

const createWindow = () => {
    const win = new BrowserWindow({
        title: 'SideKi Macro Deck',
        width: 1400, 
        height: 900,
        autoHideMenuBar: true,
        center: true,
        resizable: true,
        icon: path.join(__dirname, 'keyboard.ico'),
        
        webPreferences: {
            nodeIntegration: true, // Quick and dirty way to get 'require' in your renderer
            contextIsolation: false, // Required for nodeIntegration to work easily
        
        },
    });
    win.loadFile('index.html');
    win.webContents.openDevTools({ mode: 'detach', activate : false });
};

app.whenReady().then(() => {
    createWindow();

    // Register global shortcuts from your GlobalShortcutManager logic
     globalShortcut.register('Control+Left', () => {
        // When the shortcut is pressed, find the main window...
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            // ...and send a message to its renderer process (your script.js).
            win.webContents.send('global-shortcut-triggered', 'toggle-run-stop');
        }
    });
});

app.on('will-quit', () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll();
});




app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});