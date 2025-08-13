const { app, screen, BrowserWindow, globalShortcut, ipcMain, dialog } = require('electron')
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
    //win.webContents.openDevTools({ mode: 'detach', activate : false });
};

const AHK_EXE_PATH = "C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe"; // If it varies per user, add input in the UI to set it

app.whenReady().then(() => {

    ipcMain.on('get-app-info', (event) => {
        // It replies immediately with an object containing the info the renderer needs.
        event.returnValue = {
            isPackaged: app.isPackaged,
            appPath: app.getAppPath(),
            userDataPath: app.getPath('userData'),
            ahkPath : AHK_EXE_PATH,
        };
    });

    createWindow();

    
    // Register global shortcuts from your GlobalShortcutManager logic
    
     globalShortcut.register('PrintScreen', () => {
        // When the shortcut is pressed, find the main window...
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            // ...and send a message to its renderer process (your script.js).
            win.webContents.send('global-shortcut-triggered', 'toggle-run-stop');
        }
    });
});



const stopAHK = async () => {
    console.log('Main: Stopping AutoHotkey script...');

    const ahkExeName = path.basename(AHK_EXE_PATH);

    // We can simplify the promise wrapper for a single command
    await new Promise(resolve => {
        exec(`taskkill /IM "${ahkExeName}"`, () => {
            console.log(`Main: Termination command for ${ahkExeName} has been sent.`);
            resolve();
        });
    });
};


let cleanupCompleted = false;

app.on('before-quit', async (e) => {
        if(!cleanupCompleted){
        // This is where you can clean up before the app quits. 
        e.preventDefault();
        await stopAHK();
        cleanupCompleted = true;
        app.quit();
    }

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



let toastInfo = {message: '', color: '', duration: 200};

// This is the full Electron implementation of your showGlobalToast function.
function showGlobalToast(message, color, duration) {
    // Get the primary display's dimensions.
    toastInfo.message = message;
    toastInfo.color = color;        
    toastInfo.duration = duration;

   

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    const toastWidth = 400, toastHeight = 120;
    const x = Math.round(width / 2 - toastWidth / 2);
    const y = Math.round(height / 2 - toastHeight / 2);

    // Translate NW.js options to Electron BrowserWindow options
    const toastWin = new BrowserWindow({
        width: toastWidth,
        height: toastHeight,
        x: x,
        y: y,
        frame: false,          // No window frame
        transparent: true,     // Allows for rounded corners and transparency
        alwaysOnTop: true,     // Stays on top of other windows
        show: false,           // Don't show it until it's ready
        resizable: false,
        focusable: false,      // Prevents the toast from stealing focus from the main app
        skipTaskbar: true,     // Does not appear in the taskbar
        webPreferences: {
            nodeIntegration: true,     // Needed for `require` in toast.js
            contextIsolation: false,
        }
    });

    toastWin.setAlwaysOnTop(true, 'screen-saver'); // Ensures it stays on top of other windows

    toastWin.loadFile('toast.html');

    // Wait for the window to finish loading its content
    toastWin.webContents.on('did-finish-load', () => {

        toastWin.webContents.executeJavaScript(`document.setToastMessage("${toastInfo.message}", "${toastInfo.color}")`, true);
        // Now, show the window
        toastWin.show();

        // Set a timeout to fade out and close the window
        setTimeout(() => {
            // Add the 'fade' class to trigger the CSS animation
           toastWin.webContents.executeJavaScript('document.body.classList.add("fade")', true);
        }, duration - 100); // Start fading 500ms before close

        setTimeout(() => {
            toastWin.close();
        }, duration);
    });
}

// Create an IPC listener that the renderer process can call.
// This is the bridge between your UI and this function.
ipcMain.on('show-toast', (event, message, color, duration) => {
    showGlobalToast(message, color, duration);
});




// Add this IPC handler. It can go anywhere after the imports.
ipcMain.handle('show-open-dialog', async (event, options) => {
    // Show the native OS file open dialog
    const result = await dialog.showOpenDialog({
        title: options.title || 'Select a File',
        buttonLabel: options.buttonLabel || 'Select',
        properties: ['openFile'],
        // This is important for filtering to just .exe files
        filters: [
            { name: 'Executables', extensions: ['exe'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    // Check if the dialog was cancelled or if no file was selected
    if (result.canceled || result.filePaths.length === 0) {
        return null; // Return null if the user cancels
    }

    // Return the full path of the single selected file
    return result.filePaths[0];
});

const iconCache = new Map();

ipcMain.handle('get-icon-for-path', async (event, path) => {
    try {
        const icon = await app.getFileIcon(path, { size: 'small' });
        return icon.toDataURL(); // Return the base64 string
    } catch {
        return null; // Return null if the icon can't be found
    }
});


// In main.js

// This uses the modern 'invoke' pattern for a clean async request/response
ipcMain.handle('show-confirm-dialog', async (event, options) => {
    // Get the window that sent the request
    const win = BrowserWindow.fromWebContents(event.sender);
    
    const dialogOpts = {
        type: 'question',
        buttons: ['Cancel', 'Yes'], // Note: On Windows, 'Cancel' is often the right-most button
        defaultId: 0, // The index of the default button (0 = Cancel)
        title: options.title || 'Confirm',
        message: options.message,
        detail: options.detail || ''
    };

    const result = await dialog.showMessageBox(win, dialogOpts);
    
    // The 'response' property will be the index of the button the user clicked.
    // We return true if they clicked 'Yes' (index 1).
    return result.response === 1;
});