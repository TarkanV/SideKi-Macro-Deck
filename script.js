//script.js 

const runDriver = true;

const { ipcRenderer } = require("electron");

const path = require("path");
const fs = require("fs").promises;
const { exec, spawn, spawnSync } = require("child_process");
const { escape } = require("querystring");
const { verify } = require("crypto");
const { stdout } = require("process");

//import GlobalShortcutManager from './GlobalShortcutManager.js';

const appInfo = ipcRenderer.sendSync("get-app-info");

// --- Constants & State ---
const DEPS_DIR = appInfo.isPackaged
  ? path.join(process.resourcesPath, "deps")
  : path.join(appInfo.appPath, "deps");
//const CONFIG_DIR = path.join(process.cwd(), './config');
const USER_CONFIG_DIR = path.join(appInfo.userDataPath, "config");
const SETTINGS_JSON_PATH = path.join(USER_CONFIG_DIR, "user-settings.json");
const AHK_SCRIPT_PATH = path.join(USER_CONFIG_DIR, "user-settings.ahk");
const AHK_CONFIG_SCRIPT_PATH = path.join(USER_CONFIG_DIR, "kb-config.ahk");
const AHK_SERVER_SCRIPT_PATH = path.join(USER_CONFIG_DIR, "kb-server.ahk");
const UNIVERSAL_MACROS_PATH = path.join(USER_CONFIG_DIR, "um-config.ahk");

// Add this line around line 13 in your script.js

const AHK_EXE_PATH = appInfo.ahkPath;
const MULTIKB_EXE_PATH = path.join(DEPS_DIR, "MKB\\MultiKB_For_AutoHotkey.exe");

const KEYBOARD_LAYOUT = [
    [{ p: "Esc", s: "Escape"}, { p: "F1", s: "F1" }, { p: "F2", s: "F2" }, { p: "F3", s: "F3" }, { p: "F4", s: "F4" }, { p: "F5", s: "F5" }, { p: "F6", s: "F6" }, { p: "F7", s: "F7" }, { p: "F8", s: "F8" }, { p: "F9", s: "F9" }, { p: "F10", s: "F10" }, { p: "F11", s: "F11" }, { p: "F12", s: "F12" }, { p: "Delete", s: "Delete" }],
    
    [{ p: "`", s: "`" }, { p: "1", s: "1" }, { p: "2", s: "2" }, { p: "3", s: "3" }, { p: "4", s: "4" }, { p: "5", s: "5" }, { p: "6", s: "6" }, { p: "7", s: "7" }, { p: "8", s: "8" }, { p: "9", s: "9" }, { p: "0", s: "0" }, { p: "-", s: "-" }, { p: "=", s: "=" }, { p: "Backspace", s: "Backspace" }],
    
    [{ p: "Tab", s: "Tab" }, { p: "Q", s: "q" }, { p: "W", s: "w" }, { p: "E", s: "e" }, { p: "R", s: "r" }, { p: "T", s: "t" }, { p: "Y", s: "y" }, { p: "U", s: "u" }, { p: "I", s: "i" }, { p: "O", s: "o" }, { p: "P", s: "p" }, { p: "[", s: "[" }, { p: "]", s: "]" }, { p: "\\", s: "\\" }],
    
    [{ p: "Caps", s: "CapsLock", disabled: true }, { p: "A", s: "a" }, { p: "S", s: "s" }, { p: "D", s: "d" }, { p: "F", s: "f" }, { p: "G", s: "g" }, { p: "H", s: "h" }, { p: "J", s: "j" }, { p: "K", s: "k" }, { p: "L", s: "l" }, { p: ";", s: ";" }, { p: "'", s: "'" }, { p: "Enter", s: "Enter" }],
    
    [{ p: "Shift", s: "LShift" }, { p: "Z", s: "z" }, { p: "X", s: "x" }, { p: "C", s: "c" }, { p: "V", s: "v" }, { p: "B", s: "b" }, { p: "N", s: "n" }, { p: "M", s: "m"}, { p: ",", s: "," }, { p: ".", s: "." }, { p: "/", s: "/" }, { p: "Shift", s: "RShift", disabled: true }],
    
    [{ p: "Ctrl", s: "LControl" }, { p: "Alt", s: "LAlt" }, { p: "Space", s: "Space" }, { p: "Alt", s: "RAlt", disabled: true }, { p: "Ctrl", s: "RControl", disabled: true }, { p: "Left", s: "Left" }, { p: "Up", s: "Up" }, { p: "Down", s: "Down" }, { p: "Right", s: "Right" }]
];

const NUMPAD_LAYOUT = [
    // Existing Row 1
    [{ p: "Shift", s: "LShift", disabled: true }, { p: "NumLk", s: "NumLock", disabled: true }, { p: "/", s: "NumpadDiv" }, { p: "*", s: "NumpadMult" }, { p: "-", s: "NumpadSub" }],
    // Existing Row 2
    [ { p: "7", s: "Numpad7" }, { p: "8", s: "Numpad8" }, { p: "9", s: "Numpad9" }, { p: "+", s: "NumpadAdd" }],
    // Row 3 (with new Shift key)
    [{ p: "4", s: "Numpad4" }, { p: "5", s: "Numpad5" }, { p: "6", s: "Numpad6" }],
    // Row 4 (with new Ctrl key)
    [ { p: "Ctrl", s: "LControl" }, { p: "1", s: "Numpad1" }, { p: "2", s: "Numpad2" }, { p: "3", s: "Numpad3" }, { p: "Enter", s: "NumpadEnter" }],
    // Row 5 (with new Alt key)
    [ { p: "Alt", s: "LAlt" }, { p: "0", s: "Numpad0" }, { p: ".", s: "NumpadDot" }]
];

const VK_MAP = {
        // --- Main Keyboard ---
        // Function Row
        'ESCAPE': 27, 'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116, 'F6': 117, 'F7': 118, 'F8': 119, 'F9': 120, 'F10': 121, 'F11': 122, 'F12': 123,

        // Number Row
        '`': 192, '1': 49, '2': 50, '3': 51, '4': 52, '5': 53, '6': 54, '7': 55, '8': 56, '9': 57, '0': 48, '-': 189, '=': 187, 'BACKSPACE': 8,

        // Top Letter Row (QWERTY)
        'TAB': 9, 'Q': 81, 'W': 87, 'E': 69, 'R': 82, 'T': 84, 'Y': 89, 'U': 85, 'I': 73, 'O': 79, 'P': 80, '[': 219, ']': 221, '\\': 220,

        // Home Row
        'CAPSLOCK': 20, 'A': 65, 'S': 83, 'D': 68, 'F': 70, 'G': 71, 'H': 72, 'J': 74, 'K': 75, 'L': 76, ';': 186, "'": 222, 'ENTER': 13,

        // Bottom Letter Row
        'LSHIFT': 160, 'Z': 90, 'X': 88, 'C': 67, 'V': 86, 'B': 66, 'N': 78, 'M': 77, ',': 188, '.': 190, '/': 191, 'RSHIFT': 161,

        // Bottom Row
        'LCONTROL': 162, 'LWIN': 91, 'LALT': 164, 'SPACE': 32, 'RALT': 165, 'RWIN': 92, 'APPSKEY': 93, 'RCONTROL': 163,

        // --- Navigation and Editing Cluster ---
        'PRINTSCREEN': 44, 'SCROLLLOCK': 145, 'PAUSE': 19,
        'INSERT': 45, 'HOME': 36, 'PGUP': 33,
        'DELETE': 46, 'END': 35, 'PGDN': 34,

        // Arrow Keys
        'UP': 38, 'DOWN': 40, 'LEFT': 37, 'RIGHT': 39,

        // --- Numpad ---
        'NUMLOCK': 144, 'NUMPADDIV': 111, 'NUMPADMULT': 106, 'NUMPADSUB': 109,
        'NUMPAD7': 103, 'NUMPAD8': 104, 'NUMPAD9': 105, 'NUMPADADD': 107,
        'NUMPAD4': 100, 'NUMPAD5': 101, 'NUMPAD6': 102,
        'NUMPAD1': 97, 'NUMPAD2': 98, 'NUMPAD3': 99, 'NUMPADENTER': 13,
        'NUMPAD0': 96, 'NUMPADDOT': 110
    };


let ahkProcess = null;

// --- NEW DATA STRUCTURE ---
const defaultData = {
  devices: {
    "Keyboard 1": { // Matches your config in myKeyboards
      vendor : "",
      prod : "",
      ignoreNumLock: false,
      programs: {
        Global: {
          displayName: "Global",
          activeProfile: "Default",
          cycleHotkey: "",
          profiles: {
            Default: {
              hotkeys: { 
                  '1': { down: `; Command Title\nMsgBox("Global profile on MySuperKeyBoard.")`, up: '' }
              }
            }
          }
        }
      }
    }
  }
};

const State = {
    data: defaultData, 
    selection: {
        deviceName: "Keyboard 1", // NEW: Track active keyboard
        programName: "Global",
        keyName: null,
        modifier: null 
    },
    status: { isEnabled: false },

    // 1. Get current program object (NOW ROUTES THROUGH DEVICE)
    getCurrentProgram() {
        const device = this.data.devices[this.selection.deviceName];
        if (!device || !device.programs) return null;
        return device.programs[this.selection.programName];
    },

    getCurrentProfile() {
        const prog = this.getCurrentProgram();
        if (!prog) return null;
        if (!prog.profiles) prog.profiles = { Default: { hotkeys: {} } };
        return prog.profiles[prog.activeProfile || "Default"];
    },

    getCurrentLayer() {
        const profile = this.getCurrentProfile();
        if (!profile) return null;
        switch (this.selection.modifier) {
            case 'LShift': return profile.shift_hotkeys || (profile.shift_hotkeys = {});
            case 'LControl': return profile.ctrl_hotkeys || (profile.ctrl_hotkeys = {});
            case 'LAlt': return profile.alt_hotkeys || (profile.alt_hotkeys = {});
            default: return profile.hotkeys || (profile.hotkeys = {});
        }
    },

    getKeyData(keyName) {
        const layer = this.getCurrentLayer();
        return (layer && layer[keyName]) ? layer[keyName] : null;
    },

    setKeyData(keyName, downScript, upScript) {
        const layer = this.getCurrentLayer();
        if (!layer) return;
        if ((!downScript || !downScript.trim()) && (!upScript || !upScript.trim())) {
            delete layer[keyName];
        } else {
            layer[keyName] = { down: downScript || "", up: upScript || "" };
        }
    },

    setLayerKeyData(layerName, keyName, downScript, upScript) {
        const layer = layerName;
        if (!layer) return;
        if ((!downScript || !downScript.trim()) && (!upScript || !upScript.trim())) {
            delete layer[keyName];
        } else {
            layer[keyName] = { down: downScript || "", up: upScript || "" };
        }
    },

    selectProgram(progName) {
        const device = this.data.devices[this.selection.deviceName];
        if (device && device.programs[progName]) {
            this.selection.programName = progName;
            this.selection.keyName = null; 
        }
    },

    toggleModifier(modName) {
        this.selection.modifier = (this.selection.modifier === modName) ? null : modName;
        this.selection.keyName = null;
    }
};


//HTML Node List 

const programListNode = document.getElementById("program-list");



// Add this near your other requires


const MacroDriver = require('./macro-driver/usb-driver.js');

// Define your target keyboards (replaces actions.yml)


// --- LIVE DRIVER STATUS INDICATOR ---
// Find where you create the status indicator and use this:
const statusDiv = document.createElement('div');
statusDiv.style = "display: flex; align-items: center; gap: 8px; font-weight: bold; padding: 0 15px;";
statusDiv.innerHTML = `
    <span id="footer-status-dot" style="color: gray; font-size: 20px;">●</span> 
    <span id="footer-status-text" style="font-size: 13px; color: #555;">Driver Offline</span>
`;
document.getElementById('footer-right').prepend(statusDiv);

// === PRECISE CHANGE: The Bridge (Fixed Crash & Logic) ===

// Forward Status (Toasts)

// --- Function to send data to AHK via the pipe ---
function sendToAhk(message) {
    // Safety check: only write if the process and the pipe exist
    if (ahkProcess && ahkProcess.stdin && ahkProcess.stdin.writable) {
        ahkProcess.stdin.write(message + '\n');
    }
}

// === THE BRIDGE: Locate this in the top level of script.js ===
MacroDriver.on('status', (info) => {
    const dot = document.getElementById('footer-status-dot');
    const text = document.getElementById('footer-status-text');
    const connectedDevices = MacroDriver.getConnectedDevices();

    if (connectedDevices.length > 0) {
        if (dot) { dot.style.color = '#4CAF50'; dot.style.textShadow = '0 0 5px #4CAF50'; }
        if (text) { text.textContent = connectedDevices.join(", "); text.style.color = '#333'; }
    } else {
        // FIXED: Using 'info.status' consistently now
        if (dot) { dot.style.color = (info.status === 'offline') ? 'gray' : '#F44336'; dot.style.textShadow = 'none'; }
        if (text) { text.textContent = (info.status === 'offline') ? 'Driver Offline' : 'Disconnected'; text.style.color = '#555'; }
    }

    // Send status to AHK for the Hooked toast
    if (info.status === 'connected') {
        // Ensure the payload has the 'type' field AHK is looking for
        const payload = {
            type: info.type || "connectionStatus",
            deviceName: info.deviceName || info.name || "Keyboard",
            status : "connected",
        };
        sendToAhk(JSON.stringify(payload));
    }

    if (info.status === 'disconnected') {
        const payload = {
            type: info.type || "connectionStatus",
            deviceName: info.deviceName || info.name || "Keyboard",
            status : "disconnected",
        };
        sendToAhk(JSON.stringify(payload));
    }
});

MacroDriver.on('key', (keyEvent) => {
    sendToAhk(JSON.stringify(keyEvent));
});

//let programProfiles = {};
//let selectedProgramName = "Global";
//let selectedKeyName = null;
let isEnabled = false;
//let activeModifier = null;

let editorDown;
let editorUp;

 editorDown = CodeMirror.fromTextArea(document.getElementById('script-editor-down'), {
            mode: "text/x-autohotkey",
            theme: "vscode-light",
            placeholder: '; Optional Title (place it after a ";") \n\nActions on key press...',
            lineNumbers: true,
            autoCloseBrackets: true,
            extraKeys: {
                "Tab": "indentMore",       // Standard tab behavior
                "Shift-Tab": "indentLess",  // Un-indent
                "Ctrl-Space": "autocomplete"
    
            }
 });

editorUp = CodeMirror.fromTextArea(document.getElementById('script-editor-up'), {
            mode: "text/x-autohotkey",
            theme: "vscode-light",
            placeholder: "Actions for key release...",
            lineNumbers: true,
            extraKeys: {
                "Tab": "indentMore",       // Standard tab behavior
                "Shift-Tab": "indentLess",  // Un-indent
                "Ctrl-Space": "autocomplete"
    
            }
});

// A function to show hints, which we'll call from an event listener
const showHints = (editor, event) => {
    // Don't show hints for non-letter keys (like Enter, space, semicolon, etc.)
    const char = event.text[0];
    if (!/[a-zA-Z_]/.test(char)) {
        return;
    }
    
    // Programmatically open the autocomplete menu
    editor.showHint({ completeSingle: false });
};

// Attach this event listener to BOTH editors
editorDown.on('inputRead', showHints);
editorUp.on('inputRead', showHints);

// ================================================================= //
//                      FUNCTION DEFINITIONS                         //
// ================================================================= //

async function loadUniversalMacros(isLog = false){
    try{   
        await fs.access(UNIVERSAL_MACROS_PATH);
        if(isLog) console.log("Universal Macros exist. Adding to script...")
        UniversalMacros =  await fs.readFile(UNIVERSAL_MACROS_PATH, "utf8");
    }catch{
        if(isLog) console.log("No Universal Macros file detected...");
        document.getElementById("universal-macros-btn").style = "display : none;";
        UniversalMacros = "";
    }
}

async function initialize() {
  renderQwertyKeyboard();
  renderNumpadKeyboard();
  
  loadUniversalMacros(true);

  try {
    const fileContent = await fs.readFile(SETTINGS_JSON_PATH, "utf8");
    let parsedData = JSON.parse(fileContent);



    State.data = parsedData;
    // --- THIS IS THE "UPGRADE AT LOAD TIME" LOGIC ---
    for (const devName in State.data.devices) {
      const programs = State.data.devices[devName].programs;
      for (const progName in programs) {
        const program = programs[progName];
        if (program.profiles) {
          for (const profName in program.profiles) {
            const profile = program.profiles[profName];
            if (profile.hotkeys) {
              for (const keyName in profile.hotkeys) {
                const hotkeyData = profile.hotkeys[keyName];
                if (typeof hotkeyData !== "object" || !hotkeyData.hasOwnProperty("down")) {
                  const newData = { down: "", up: "" };
                  if (typeof hotkeyData === "string") newData.down = hotkeyData;
                  else if (hotkeyData && hotkeyData.triggerOn === "up") newData.up = hotkeyData.script;
                  else if (hotkeyData && hotkeyData.triggerOn === "down") newData.down = hotkeyData.script;
                  profile.hotkeys[keyName] = newData; 
                }
              }
            }
          }
        }
      }
    }
    // --- END OF UPGRADE LOGIC ---
  } catch (err) {
    State.data = defaultData;
  }

  const availableDevices = Object.keys(State.data.devices || {});
  if (availableDevices.length > 0) {
      State.selection.deviceName = availableDevices[0];
  } else {
      State.selection.deviceName = "Keyboard 1";
  }
  
  renderUI();
}

function renderUI() {
  renderDeviceSelector(); 
  renderProgramList();
  renderProfileDetails();
  updateKeyboardVisuals();
}

// === PRECISE CHANGE: FULL DEVICE MANAGEMENT UI ===
function renderDeviceSelector() {
    let container = document.getElementById('device-selector-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'device-selector-container';
        
        
        container.innerHTML = `
            <span class="material-symbols-outlined">keyboard</span>
            <select id="device-selector"></select>
            <button id="add-device-btn" title="Add Keyboard" style="padding: 2px 6px;">+</button>
            <button id="edit-device-btn" title="Edit Keyboard IDs" style="padding: 2px 6px;">✎</button>
            <button id="delete-device-btn" title="Delete Keyboard" style="padding: 2px 6px;">-</button>
        `;
        document.getElementById('program-list-container').prepend(container);

        // Dropdown switch logic
        document.getElementById('device-selector').addEventListener('change', (e) => {
            State.selection.deviceName = e.target.value;
            State.selection.programName = "Global"; 
            State.selection.keyName = null;
            renderUI();
        });

        // Add Device Logic
        document.getElementById('add-device-btn').addEventListener('click', async () => {
            // Inside document.getElementById('add-device-btn').addEventListener...
        const { value: formValues } = await Swal.fire({
            title: 'Add New Keyboard',
            html:
                '<div class="device-info"><input id="swal-dev-name" class="swal2-input" placeholder="Keyboard Name (e.g. Numpad)"></div>' +
                '<div class="device-info"><span class="id-prefix">0x</span><input id="swal-dev-vid" class="swal2-input" placeholder="Vendor ID (e.g. 0xC0F4)"></div>' +
                '<div class="device-info"><span class="id-prefix">0x</span><input id="swal-dev-pid" class="swal2-input" placeholder="Product ID (e.g. 0x04E0)"></div>' +
                // === PRECISE CHANGE: Add Checkbox ===
                '<div style="margin-top:15px; text-align:left; width:80%; margin-left:auto; margin-right:auto;">' +
                '<input  type="checkbox" id="swal-dev-ignore-num" style="transform: scale(1.2); margin-right: 8px;">' +
                '<label for="swal-dev-ignore-num">Ignore Host NumLock</label></div>',
            focusConfirm: false,
            showCancelButton: true,
            preConfirm: () => {
                const name = document.getElementById('swal-dev-name').value.trim();
                if (!name) return Swal.showValidationMessage('Keyboard Name is required');
                if (State.data.devices[name]) return Swal.showValidationMessage('Name already exists');
                
                return {
                    name: name,
                    vid: document.getElementById('swal-dev-vid').value.trim(),
                    pid: document.getElementById('swal-dev-pid').value.trim(),
                    ignoreNumLock: document.getElementById('swal-dev-ignore-num').checked // Grab checkbox
                }
            }
        });

        if (formValues) {
            State.data.devices[formValues.name] = {
                vendor: formValues.vid,
                prod: formValues.pid,
                ignoreNumLock: formValues.ignoreNumLock, // Save checkbox
                programs: { Global: { displayName: "Global", activeProfile: "Default", cycleHotkey: "", profiles: { Default: { hotkeys: {} } } } }
            };
            State.selection.deviceName = formValues.name;
            State.selection.programName = "Global";
            renderUI();
        }
        });

        // Edit Device Logic
        // Edit Device Logic inside renderDeviceSelector
        // Inside document.getElementById('edit-device-btn').addEventListener...
        document.getElementById('edit-device-btn').addEventListener('click', async () => {
            const currentDev = State.selection.deviceName;
            const devData = State.data.devices[currentDev];
            
            // === PRECISE CHANGE: Read current state for checkbox ===
            const isChecked = devData.ignoreNumLock ? "checked" : "";

            const { value: formValues } = await Swal.fire({
                title: `Edit ${currentDev}`,
                html:
                    `<div class="input-field" style="text-align:left; width:80%; margin:auto;">` +
                    ` <label>Device Name:</label><div class="device-info"><input id="swal-dev-name" class="swal2-input" value="${currentDev}"></div>` +
                    `<label>Vendor ID:</label><div class="device-info"><span class="id-prefix">0x</span><input id="swal-dev-vid" class="swal2-input" value="${devData.vendor}"></div>` +
                    `<label>Product ID:</label><div class="device-info"><span class="id-prefix">0x</span><input id="swal-dev-pid" class="swal2-input" value="${devData.prod}"></div>` +
                    // === PRECISE CHANGE: Add Checkbox ===
                    `<div style="margin-top:15px;">` +
                    `<input type="checkbox" id="swal-dev-ignore-num" style="transform: scale(1.2); margin-right: 8px;" ${isChecked}>` +
                    `<label for="swal-dev-ignore-num">Ignore Host NumLock</label></div>` +
                    `</div>`,
                focusConfirm: false,
                showCancelButton: true,
                preConfirm: () => {
                    const newName = document.getElementById('swal-dev-name').value.trim();
                    if (!newName) return Swal.showValidationMessage('Name is required');
                    if (newName !== currentDev && State.data.devices[newName]) {
                        return Swal.showValidationMessage('This device name already exists');
                    }

                    return {
                        name: newName,
                        vid: document.getElementById('swal-dev-vid').value.trim(),
                        pid: document.getElementById('swal-dev-pid').value.trim(),
                        ignoreNumLock: document.getElementById('swal-dev-ignore-num').checked // Grab checkbox
                    }
                }
            });

            if (formValues) {
                if (formValues.name !== currentDev) {
                    State.data.devices[formValues.name] = State.data.devices[currentDev];
                    delete State.data.devices[currentDev];
                    State.selection.deviceName = formValues.name;
                }

                State.data.devices[State.selection.deviceName].vendor = formValues.vid;
                State.data.devices[State.selection.deviceName].prod = formValues.pid;
                State.data.devices[State.selection.deviceName].ignoreNumLock = formValues.ignoreNumLock; // Save checkbox

                Swal.fire('Updated!', 'Changes saved in memory.', 'success');
                renderUI(); 
            }
        });
        // Delete Device Logic
        document.getElementById('delete-device-btn').addEventListener('click', async () => {
            const currentDev = State.selection.deviceName;
            const devKeys = Object.keys(State.data.devices);
            
            if (devKeys.length <= 1) {
                return Swal.fire('Error', 'You cannot delete the last keyboard.', 'error');
            }

            const result = await Swal.fire({
                title: 'Are you sure?',
                text: `You will lose all macros assigned to ${currentDev}!`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                delete State.data.devices[currentDev];
                State.selection.deviceName = Object.keys(State.data.devices)[0]; // Fallback to first available
                State.selection.programName = "Global";
                renderUI();
            }
        });
    }
    
    // Refresh the dropdown options
    const select = document.getElementById('device-selector');
    select.innerHTML = "";
    for (const devName in State.data.devices) {
        const opt = document.createElement('option');
        opt.value = devName;
        opt.textContent = devName;
        select.appendChild(opt);
    }
    select.value = State.selection.deviceName;
}


const stopAllProcesses = async () => {
  const statusMsg = document.getElementById("status-message");
  statusMsg.textContent = "Shutting down gracefully...";

  // 1. Stop the Macro Driver first
  // This sends 'up' events for all currently held keys to the AHK pipe
  if (typeof MacroDriver !== 'undefined' && MacroDriver.isRunning) {
      await MacroDriver.stop();
  }

  // 2. Tell AHK to clean up and exit
  if (ahkProcess) {
      try {
          // Send the quit command
          sendToAhk(JSON.stringify({ type: "quit" }));
          
          // Give AHK 300ms to run its OnExit cleanup and send {Alt Up}, etc.
          //const result_dir = path.join(USER_CONFIG_DIR, "result.txt");
        

          
          await new Promise(resolve => setTimeout(resolve, 300));

          if (ahkProcess.exitCode === null) {
             // await fs.writeFile(result_dir, "TOO LATE!!!" ,  "utf-8");
              ahkProcess.kill(); // Final safety kill
              ahkProcess = null;
          }else{
            console.log("AHK closed safely!");
            //await fs.writeFile(result_dir, "AHK closed safely...", "utf-8");
          }
      } catch (e) {
          console.error("Error during AHK shutdown:", e);
      }
  }

  // 3. Final Cleanup of any ghost processes
  const ahkExeName = path.basename(AHK_EXE_PATH);
  exec(`taskkill /IM "${ahkExeName}" /T`, (err) => {
      // We don't really care if this fails, it's just a last resort
      statusMsg.textContent = "All processes stopped.";
      statusMsg.style.color = "green";
  });

  isEnabled = false;
};



function renderQwertyKeyboard() {
    const keyboardContainer = document.getElementById('qwerty-keyboard');
    const rowTemplate = document.getElementById('keyboard-row-template');
    const keyTemplate = document.getElementById('keyboard-key-template');
    
    keyboardContainer.innerHTML = '';

    KEYBOARD_LAYOUT.forEach(rowLayout => {
        const rowClone = rowTemplate.content.cloneNode(true);
        const rowDiv = rowClone.querySelector('.keyboard-row');

        rowLayout.forEach(keyData => {
            const keyClone = keyTemplate.content.cloneNode(true);
            const keyDiv = keyClone.querySelector('.keyboard-key');
            const primaryLabel = keyClone.querySelector('.primary-label');

            keyDiv.dataset.keyName = keyData.s;
            primaryLabel.textContent = keyData.p;
            
            if (keyData.disabled) {
                keyDiv.classList.add('disabled');
            }

            rowDiv.appendChild(keyClone);
        });

        keyboardContainer.appendChild(rowClone);
    });
}

// In script.js
// In script.js
// REPLACE this entire function

// In script.js
// REPLACE this entire function

function renderNumpadKeyboard() {
    const numpadContainer = document.getElementById('numpad-keyboard');
    numpadContainer.innerHTML = ''; // Clear it first

    // Flatten the layout array into a single list of keys
    const allNumpadKeys = NUMPAD_LAYOUT.flat();

    allNumpadKeys.forEach(keyData => {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'keyboard-key';
        keyDiv.dataset.keyName = keyData.s;
        if (keyData.disabled) {
            keyDiv.classList.add('disabled');
        }
        keyDiv.innerHTML = `<span class="key-description"></span><div class="key-labels-container"><span class="primary-label">${keyData.p}</span></div>`;
        
        // Append the key DIRECTLY to the numpad grid container
        numpadContainer.appendChild(keyDiv); 
    });
}

function extractDescriptionFromScript(script) {
  if (!script || typeof script !== "string" || script.trim() === "") {
    return "";
  }
  const firstLine = script.split("\n")[0].trim();
  if (firstLine.startsWith(";")) {
    // Return the text after the ';', trimmed of any leading space
    return firstLine.substring(1).trim();
  }
  return "";
}

// In script.js

async function showProcessList() {
    const modal = document.getElementById('process-modal');
    const loader = document.getElementById('modal-loader');
    const processListDiv = document.getElementById('modal-process-list');
    const template = document.getElementById('process-item-template'); // Reference the template

    // --- Start: Your existing setup code (UNCHANGED) ---
    if (!document.getElementById('process-list-styles')) {
        const style = document.createElement('style');
        style.id = 'process-list-styles';
        style.innerHTML = `
            #modal-process-list { overflow-y: auto; border: 1px solid #ccc; border-radius: 5px; padding: 5px; }
            .process-item { display: flex; align-items: center; padding: 8px 10px; cursor: pointer; border-radius: 4px; transition: background-color 0.2s; user-select: none; }
            .process-item:hover { background-color: #e9e9e9; }
            .process-icon { width: 24px; height: 24px; margin-right: 12px; }
            .process-name { font-size: 14px; color: #333; }
        `;
        document.head.appendChild(style);
    }
    modal.style.display = 'flex';
    loader.style.display = 'block';
    processListDiv.innerHTML = '';
    const execPromise = (command) => new Promise((resolve, reject) => {
        exec(command, (error, stdout) => {
            if (error) return reject(error);
            resolve(stdout);
        });
    });
    // --- End: Your existing setup code (UNCHANGED) ---

    try {
        // --- Start: Your existing data-fetching code (UNCHANGED) ---
        let processes = [];
        if (process.platform === 'win32') {
            const stdout = await execPromise('wmic process where "ExecutablePath is not null" get ExecutablePath,Name /format:csv');
         

            const lines = stdout.trim().split('\n').slice(1);
            
            const uniqueProcs = new Map();
            lines.forEach(line => {
                const parts = line.split(',');
                const exePath = parts[1]?.trim();
                const exeName = parts[2]?.trim();
                if (exeName && exeName.endsWith('.exe') && !uniqueProcs.has(exeName)) {
                    uniqueProcs.set(exeName, { name: exeName, path: exePath });
                }
            });
            processes = Array.from(uniqueProcs.values()).sort((a, b) => a.name.localeCompare(b.name));
        }
        // --- End: Your existing data-fetching code (UNCHANGED) ---

        if (processes.length === 0) {
            processListDiv.textContent = 'No running application processes found.';
            return;
        }

        // --- Start: NEW TEMPLATE-BASED RENDERING LOGIC ---
        const fragment = document.createDocumentFragment();
        for (const proc of processes) {
            const clone = template.content.cloneNode(true);
            const item = clone.querySelector('.process-item');
            const iconImg = clone.querySelector('.process-icon');
            const nameSpan = clone.querySelector('.process-name');

            item.dataset.exeName = proc.name;
            nameSpan.textContent = proc.name;

            // This is the correct way to await inside a loop without blocking.
            // We invoke and then handle the promise for each icon individually.
            ipcRenderer.invoke("get-icon-for-path", proc.path).then(iconURL => {
                if (iconURL) {
                    iconImg.src = iconURL;
                }
            });
            
            fragment.appendChild(clone);
        }
        processListDiv.appendChild(fragment);
        // --- End: NEW TEMPLATE-BASED RENDERING LOGIC ---

    } catch (error) {
        processListDiv.textContent = `Error fetching processes: ${error.message}`;
        console.error(error);
    } finally {
        loader.style.display = 'none';
    }
}


function renderProgramList() {
    
    const scrollTop = programListNode.scrollTop;


    const template = document.getElementById('program-item-template');
    programListNode.innerHTML = '';

    const currentPrograms = State.data.devices[State.selection.deviceName].programs;
    
    for (const progName in currentPrograms) {
        const program = currentPrograms[progName];
        
        const clone = template.content.cloneNode(true);
        const item = clone.querySelector('.program-item');
        const iconImg = clone.querySelector('.program-list-icon');
        const displayNameSpan = clone.querySelector('.program-display-name');
        const internalNameSpan = clone.querySelector('.program-internal-name');
        const renameInput = clone.querySelector('.program-rename-input');
        const deleteBtn = clone.querySelector('.delete-btn');

        item.dataset.programName = progName;
        if (progName === State.selection.programName) {
            item.classList.add('selected');
        }

        // The new logic with the special case for Global

        // --- START: Icon Logic ---
        if (progName === 'Global') {
            // If it's the Global profile, use the local global.png file.
            iconImg.src = './res/global.png'; 
            iconImg.style.backgroundColor = 'transparent';
        } else if (program.path) {
            // For all other programs, use the existing cache-first fetching logic.
            ipcRenderer.invoke('get-icon-for-path', program.path).then(iconDataURL => {
                if (iconDataURL) {
                    iconImg.src = iconDataURL;
                    iconImg.style.backgroundColor = 'transparent';
                }
            });
        }

      
        displayNameSpan.textContent = program.displayName || progName;
        renameInput.value = program.displayName || progName;

        if (program.displayName && program.displayName !== progName) {
            internalNameSpan.textContent = ` [${progName}]`;
        }
        
        if (progName === 'Global') {
            deleteBtn.remove();
        }

        programListNode.appendChild(clone);
    }

    
  
    programListNode.scrollTop = scrollTop;
}


// REPLACE this entire function in script.js


const keyContainer = document.getElementById("keyboard-views-container");




function dragMoveKeyDataNew(){
    let dragging = false;
    let clicked = false;
    let ghost;

    let draggedNode = null;
    let draggedNodeName = "";
    let draggedData  = null;
    let draggedLayer = null;
   

    let targetData = null;
    let draggedKeyName = "";

    function createGhost(e, itemDescription){
        if(itemDescription !== null){
            ghost = document.createElement("div");
            ghost.style.width = "80px";
            ghost.style.height = "40px";
            ghost.style.backgroundColor = "lightgray";
            ghost.style.borderRadius = '12px';
            ghost.style.padding = '10px 5px';
            ghost.style.fontSize = '12px';
            ghost.style.textAlign = 'center';
            ghost.style.fontWeight = 'bolder';
            ghost.textContent = itemDescription;
            ghost.style.position = "fixed";
            ghost.style.pointerEvents = "none";
            ghost.style.opacity = "0.85";
        
            document.body.appendChild(ghost);  
        }
    }

    function toggleModifierAndUpdate(modifier){
        State.toggleModifier(modifier);
        renderProfileDetails();
        updateKeyboardVisuals();
    }
    

    document.addEventListener("keydown", (e)=>{
      
            if(e.key == "1" && e.ctrlKey)
                toggleModifierAndUpdate("LShift");
            if(e.key == "2"  && e.ctrlKey)    
                toggleModifierAndUpdate("LControl"); 
            if(e.key == "3"  && e.ctrlKey)  
                toggleModifierAndUpdate("LAlt"); 
        
   
    });

    keyContainer.addEventListener("mousedown", (e) => {
        const keyNode =  e.target.closest(".keyboard-key");
        if(!keyNode) return;

        draggedNode = keyNode;
        draggedNodeName = keyNode.querySelector(".key-description").textContent;
        draggedKeyName = keyNode.dataset.keyName;
        draggedData = State.getKeyData(draggedKeyName);  
        draggedLayer = State.getCurrentLayer();
        

       
        
        clicked = true;
    

    });

    document.body.addEventListener("mousemove", (e) => {
        if(!clicked) return;
       
        if(!dragging) createGhost(e, draggedNodeName);
        dragging = true;
        if(!ghost) return;
         ghost.style.transform = "translate(-50%, -50%)";
         ghost.style.left = `${e.clientX}px`;
         ghost.style.top = `${e.clientY}px`;
    });

    document.addEventListener("mouseup", (e) => {
        dragging = false;
        clicked = false;

        if (!ghost) return;
        const keyNode = e.target.closest(".keyboard-key");
        if(keyNode){
            const targetKeyName = keyNode.dataset.keyName;

            targetData = State.getKeyData(targetKeyName);

            // Swap...
            if(draggedData) State.setKeyData(targetKeyName, draggedData.down, draggedData.up);
            else State.setKeyData(targetKeyName,  "", "");
            if(targetData) State.setLayerKeyData(draggedLayer, draggedKeyName, targetData.down, targetData.up);
            else State.setLayerKeyData(draggedLayer, draggedKeyName, "", "")
            
            renderProfileDetails();
            updateKeyboardVisuals();

        }
        ghost.remove();
        ghost = null;
        
    });

     window.addEventListener("blur", (e) => {
        dragging = false;
        clicked = false;
        if(ghost){
            ghost.remove();
            ghost = null;
        }
     });
}


dragMoveKeyDataNew();

function renderProfileDetails() {
    const programSpecificSettingsDiv = document.getElementById("program-specific-settings");
    const programPathDisplay = document.getElementById("program-path-display");
    const windowTitleInput = document.getElementById("window-title-input");
    const enableCycleHotkeyCheckbox = document.getElementById("enable-cycle-hotkey");
    const cycleHotkeyInput = document.getElementById("cycle-hotkey-input");
    const currentProgramNameSpan = document.getElementById("current-program-name");
    const profileSelect = document.getElementById("mapping-profile-select");
    const deleteProfileBtn = document.getElementById("delete-profile-btn");
    
    

    const currentKeyNameSpanDown = document.getElementById("current-key-name-down");

     const currentProgram = State.getCurrentProgram(); 
    if (!currentProgram) return;

    currentProgramNameSpan.textContent = currentProgram.displayName || State.selection.programName;

    if (State.selection.programName === "Global") {
        programSpecificSettingsDiv.style.visibility = "hidden";
    } else {
        programSpecificSettingsDiv.style.visibility = "visible";
        programPathDisplay.value = currentProgram.path || "Path not set";
        windowTitleInput.value = currentProgram.windowTitle || "";
    }

    profileSelect.innerHTML = "";
    for (const profName in currentProgram.profiles) {
        const option = document.createElement("option");
        option.value = profName;
        option.textContent = profName;
        profileSelect.appendChild(option);
    }
    profileSelect.value = currentProgram.activeProfile || "Default";
    deleteProfileBtn.disabled = profileSelect.value === "Default";

    
    const currentProfileName = profileSelect.value;

    currentKeyNameSpanDown.textContent = State.selection.keyName || "None";

   // Assume editorDown and editorUp are the CodeMirror instances from the previous example
    

    if (State.selection.keyName) {
        // Enable the editors
        editorDown.setOption("readOnly", false);
        editorUp.setOption("readOnly", false);

        const hotkeyData = State.getKeyData(State.selection.keyName); // Read from your map
        
       
        if (hotkeyData) {
            // Use setValue() to update the content
    
            editorDown.setValue(hotkeyData.down || "");
            editorUp.setValue(hotkeyData.up || "");
        } else {
            editorDown.setValue("");
            editorUp.setValue("");
        }

        // It's good practice to focus the editor after enabling it
        
        editorDown.focus();

    } else {
        // Disable the editors
        editorDown.setOption("readOnly", "nocursor");
        editorUp.setOption("readOnly", "nocursor");
        
        // Clear their content
        editorDown.setValue("");
        editorUp.setValue("");
    }

    const cycleHotkey = currentProgram.cycleHotkey || "";
    enableCycleHotkeyCheckbox.checked = !!cycleHotkey;
    cycleHotkeyInput.value = cycleHotkey;
    cycleHotkeyInput.disabled = !enableCycleHotkeyCheckbox.checked;
    runAllValidations();
}

// In script.js

// REPLACE your entire updateKeyboardVisuals function with this one:

// REPLACE this entire function in script.js
// REPLACE this entire function in script.js
function updateKeyboardVisuals() {
    const profileSelect = document.getElementById("mapping-profile-select");
    const cycleHotkeyInput = document.getElementById("cycle-hotkey-input");
    const enableCycleHotkeyCheckbox = document.getElementById("enable-cycle-hotkey");

    if (!profileSelect || !cycleHotkeyInput || !enableCycleHotkeyCheckbox) return;

    const isCycleEnabled = enableCycleHotkeyCheckbox.checked;
    const cycleHotkey = cycleHotkeyInput.value.trim().toLowerCase();
    
    // We already got these earlier in your code, but let's be safe
    const currentProfile = State.getCurrentProfile();

    if (!currentProfile) {
        document.querySelectorAll(".keyboard-key").forEach(keyDiv => {
            keyDiv.classList.remove("assigned", "editing", "reserved", "modifier-active", "has-modifier-macro");
        });
        return;
    };

    document.querySelectorAll(".keyboard-key").forEach((keyDiv) => {
        const keyName = keyDiv.dataset.keyName;
        keyDiv.classList.remove("assigned", "editing", "reserved", "modifier-active", "has-modifier-macro");

        // 1. Get the hotkey data for the CURRENTLY VISIBLE layer
        const hotkeyDataOnThisLayer = State.getKeyData(keyName);

        // 2. Extract description (visuals)
        const downScript = hotkeyDataOnThisLayer?.down || "";
        const descriptionSpan = keyDiv.querySelector(".key-description");
        if (descriptionSpan) {
            descriptionSpan.textContent = extractDescriptionFromScript(downScript);
            descriptionSpan.title = descriptionSpan.textContent;
        }

        // 3. Class assignments
        if (hotkeyDataOnThisLayer) {
            keyDiv.classList.add("assigned");
        }
        

        // --- INSERT THIS NEW BLOCK ---
        const currentMod = State.selection.modifier; // 'LShift', 'LControl', 'LAlt', or null
        let hasMacroOnOtherLayer = false;

        // Check Shift Layer (If we aren't currently looking at Shift)
        if (currentMod !== 'LShift' && currentProfile.shift_hotkeys && currentProfile.shift_hotkeys[keyName]) {
            hasMacroOnOtherLayer = true;
        }
        // Check Ctrl Layer
        if (currentMod !== 'LControl' && currentProfile.ctrl_hotkeys && currentProfile.ctrl_hotkeys[keyName]) {
            hasMacroOnOtherLayer = true;
        }
        // Check Alt Layer
        if (currentMod !== 'LAlt' && currentProfile.alt_hotkeys && currentProfile.alt_hotkeys[keyName]) {
            hasMacroOnOtherLayer = true;
        }
        // Check Base Layer (If we are looking at a modifier layer, check if base has a macro)
        if (currentMod !== null && currentProfile.hotkeys && currentProfile.hotkeys[keyName]) {
            hasMacroOnOtherLayer = true;
        }

        if (hasMacroOnOtherLayer) {
            keyDiv.classList.add("has-modifier-macro");
        }


        // --- INSERT THIS NEW BLOCK ---
        if (keyName === State.selection.modifier) {
            keyDiv.classList.add('modifier-active');
        }
        

        if (isCycleEnabled && cycleHotkey && keyName.toLowerCase() === cycleHotkey) {
            keyDiv.classList.add("reserved");
        }
       
        // --- INSERT THIS NEW BLOCK ---
        if (keyName === State.selection.keyName) {
            keyDiv.classList.add("editing");
        }
    });
}

// A more explicit and robust conflict checker
// In script.js

function checkForProgramConflicts() {
  const statusMsg = document.getElementById("status-message");
  const saveBtn = document.getElementById("save-btn");
  const seenCombinations = new Map();

   const currentPrograms = State.data.devices[State.selection.deviceName].programs;

  for (const progName in currentPrograms) {
    if (progName === "Global") continue;
    const program = currentPrograms[progName];
    if (!program.exeName) continue;

    const combinationKey = `${program.exeName.toLowerCase()}|${(program.windowTitle || "").toLowerCase()}`;

    if (seenCombinations.has(combinationKey)) {
      const originalProgInfo = seenCombinations.get(combinationKey);

      // --- THIS IS THE FIX ---
      const currentDisplayName = program.displayName || progName;
      const originalDisplayName = originalProgInfo.display;
      const originalProgName = originalProgInfo.name;

      // Use the user-friendly format you suggested
      const errorMessage = `Error: "${currentDisplayName} [${progName}]" conflicts with "${originalDisplayName} [${originalProgName}]". Both target the same EXE and Window Title.`;
      // --- END OF FIX ---

      statusMsg.textContent = errorMessage;
      statusMsg.style.color = "red";
      saveBtn.disabled = true;
      saveBtn.title = "Cannot save due to program conflict.";
      return false;
    }
    // Store both the name and the display name for future error messages
    seenCombinations.set(combinationKey, {
      name: progName,
      display: program.displayName || progName,
    });
  }

  return true;
}

// UPDATED: Now disables the save button on conflict
function checkForHotkeyConflicts() {
  const hotkeyConflictWarning = document.getElementById(
    "hotkey-conflict-warning"
  );
  const cycleHotkeyInput = document.getElementById("cycle-hotkey-input");
  const enableCycleHotkeyCheckbox = document.getElementById(
    "enable-cycle-hotkey"
  );
  const saveBtn = document.getElementById("save-btn"); // Get the save button

  // --- Step 1: Default State ---
  hotkeyConflictWarning.textContent = ""; // Clear previous warnings
  saveBtn.disabled = false; // Enable save button by default
  saveBtn.title = "Save settings and generate AHK script";

  if (!hotkeyConflictWarning || !cycleHotkeyInput || !enableCycleHotkeyCheckbox)
    return;

  // --- Step 2: Check for Conflicts ---
  const cycleHotkey = cycleHotkeyInput.value.trim();
  if (!enableCycleHotkeyCheckbox.checked || !cycleHotkey) return; // If no hotkey, nothing to do.

  // AHK hotkeys are case-insensitive, so we should compare them that way.
  const hotkeyPattern = cycleHotkey.toLowerCase() + "::";

  const currentProgram = State.getCurrentProgram();

  for (const profileName in currentProgram.profiles) {
    const profile = State.getCurrentProfile();
    if (profile.hotkeys) {
      // Find any hotkey definition that starts with our cycle hotkey pattern
      for (const hotkeyDef in profile.hotkeys) {
        if (hotkeyDef.toLowerCase() === cycleHotkey.toLowerCase()) {
          // --- Step 3: Conflict Found! ---
          hotkeyConflictWarning.textContent = `Error: Cycle hotkey '${cycleHotkey}' conflicts with a key in profile '${profileName}'!`;
          saveBtn.disabled = true;
          saveBtn.title = "Cannot save due to hotkey conflict.";
          return false; // Conflict found
        }
      }
    }
  }
}

// The master validation controller
function runAllValidations() {
  const statusMsg = document.getElementById("status-message");
  const saveBtn = document.getElementById("save-btn");

  // --- Step 1: Reset to a "Good" State ---
  // This is the CRITICAL fix for the stale message.
  statusMsg.textContent = "";
  saveBtn.disabled = false;
  saveBtn.title = "Save settings and generate AHK script";

  // --- Step 2: Run Validators ---
  // If a validator finds a conflict, it will set the error state and return false.
  if (!checkForProgramConflicts()) {
    return;
  }
  if (!checkForHotkeyConflicts()) {
    return;
  }
}

// ================================================================= //
//      AHK SCRIPT GENERATION (with WiseGui Toast Notifications)     //
// ================================================================= //

function keyToVk(keyName) {
  const upperKey = keyName.toUpperCase();
  


  return VK_MAP[upperKey] || 0;
}

// In script.js



/**
 * Generates the AHK hotkey script content based on the new server architecture,
 * while maintaining compatibility with the existing JSON data structure.
 */


let UniversalMacros;

const isUniversalMacros = true;
const safeDepsDir = DEPS_DIR ? DEPS_DIR.replace(/\\/g, "\\\\").replace(/`/g, '``').replace(/"/g, '""') : ".";


// This is the final, verified server script.
// It uses atomic passthrough sends and correct lonely-modifier logic.
const serverAHKScript = `#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent
SendMode "Input"

#Include "kb-config.ahk"
#Include "${safeDepsDir}\\Lib\\jsongo.v2.ahk"


; CHANGE: Broadcast initial OS lock states to Node on startup ===
FileAppend('{"type": "syncLocks", "caps": ' (GetKeyState("CapsLock", "T") ? "true" : "false") ', "num": ' (GetKeyState("NumLock", "T") ? "true" : "false") ', "scroll": ' (GetKeyState("ScrollLock", "T") ? "true" : "false") '}\`n', "*")

global activeKeys := Map()
global pressedKeys := Map()
global stdinBuffer := ""

; --- 1. DATA ENTRY (Stdin Pipe via Native Windows API) ---
; We check the pipe manually to avoid freezing the thread!
SetTimer(ReadStdin, 2) ; Polling the pipe rapidly (2ms)

ReadStdin() {
    static hPipe := DllCall("GetStdHandle", "Int", -10, "Ptr")
    local bytesAvail := 0
    
    ; Check if data is waiting. If not, yield immediately so Timers/Repeat logic can run!
    if !DllCall("PeekNamedPipe", "Ptr", hPipe, "Ptr", 0, "UInt", 0, "Ptr", 0, "UIntP", &bytesAvail, "Ptr", 0) || bytesAvail = 0
        return

    local buf := Buffer(bytesAvail)
    local bytesRead := 0
    
    ; Read directly from the OS buffer without blocking
    if DllCall("ReadFile", "Ptr", hPipe, "Ptr", buf.Ptr, "UInt", bytesAvail, "UIntP", &bytesRead, "Ptr", 0) {
        global stdinBuffer
        stdinBuffer .= StrGet(buf, bytesRead, "UTF-8")
        
        Loop {
            local pos := InStr(stdinBuffer, "\`n")
            if (!pos)
                break
                
            local line := SubStr(stdinBuffer, 1, pos - 1)
            stdinBuffer := SubStr(stdinBuffer, pos + 1)
            
            line := Trim(line, "\`r")
            if (line = "")
                continue
                
            try {
                local parsedJson := jsongo.Parse(line)
                if (parsedJson.Has("type")) {
                    if (parsedJson["type"] = "keyEvent") {
                        
                        ; === PRECISE CHANGE: Instant Processing ===
                        ; We bypass the queue and process the key immediately!
                        ProcessKeyPress(parsedJson)
                        
                    }
                    else if (parsedJson["type"] = "quit") {
                        ; === PRECISE CHANGE: Graceful internal exit ===
                        ExitApp() 
                    }
                     else if (parsedJson["type"] = "connectionStatus") {
                        for k, timerObj in pressedKeys {
                            timerObj.Stop()
                            Send("{Blind}{" . k . " Up}")
                        }
                        pressedKeys.Clear()
                        activeKeys.Clear()
                        Send("{Blind}{LCtrl Up}{RCtrl Up}{LAlt Up}{RAlt Up}{LShift Up}{RShift Up}{LWin Up}{RWin Up}")
                        
                        local dName := parsedJson.Has("deviceName") ? parsedJson["deviceName"] : "Keyboard"

                        if(parsedJson["status"] = "connected"){
                           ShowToast(dName . " Hooked!")
                        }
                        else{
                            ShowToast(dName . " Disconnected!")
                        }
                    }
                }
            } catch {
                continue
            }
        }
    }
}

; --- 2. KEYPRESS LOGIC (Instant Execution) ---
ProcessKeyPress(keyEvent)
{
    global activeKeys, pressedKeys
    local deviceName := keyEvent["device"]["name"]

    keyName := GetKeyNameFromCode(keyEvent["key"], deviceName)
    local deviceName := keyEvent["device"]["name"]

    if (keyName = "")
    {
        return
    }
    
    if (keyEvent["state"] = "down")
    {
        activeKeys[keyName] := true
    }
    else
    {
        activeKeys.Delete(keyName)
    }    
    
    if (HandleHotkey(deviceName, keyName, keyEvent["state"], activeKeys))
    {       
        return ; Consume the keypress, whether it was up or down.
    }
    
    local isModifier := ( InStr(keyName, "Control") || InStr(keyName, "Alt") || InStr(keyName, "Shift") || InStr(keyName, "Win") )
    
    ; --- PASSTHROUGH PATH ---
    if (keyEvent["state"] = "down")
    {
        if (!pressedKeys.Has(keyName))
        {
            Send("{Blind}{" . keyName . " Down}")
            if (!isModifier)
            {
                timer := KeyRepeatHandler(keyName)
                timer.Start()
                pressedKeys[keyName] := timer
            }
        }
    }
    else if (keyEvent["state"] == "up")
    {
        Send("{Blind}{" . keyName . " Up}")
        if (pressedKeys.Has(keyName))
        {
            pressedKeys[keyName].Stop()
            pressedKeys.Delete(keyName)
        }
    }    
}

; --- 3. REPEAT HANDLER (Word-for-Word Original) ---
class KeyRepeatHandler
{
    keyName := ""
    initialFunc := ""
    repeatFunc := ""
    initialTimerHasFired := false

    __New(keyName)
    {
        this.keyName := keyName
        this.initialFunc := this.InitialRepeat.Bind(this)
        this.repeatFunc := this.SubsequentRepeat.Bind(this)
    }

    Start()
    {
        this.initialTimerHasFired := false
        SetTimer(this.initialFunc, -500)
    }

    InitialRepeat()
    {
        Critical "On"
        this.initialTimerHasFired := true
        Send("{Blind}{" . this.keyName . " Down}")
        SetTimer(this.repeatFunc, 30)
        Critical "Off"
    }

    SubsequentRepeat()
    {
        Send("{Blind}{" . this.keyName . " Down}")
    }

    Stop()
    {
        Critical "On"
        if (!this.initialTimerHasFired)
        {
            SetTimer(this.initialFunc, 0)
        }
        SetTimer(this.repeatFunc, 0)
        Critical "Off"
    }
}

; --- 4. KEY MAP (Updated with Dynamic NumLock State Handling) ---
GetKeyNameFromCode(code, deviceName := "") {
    static keyMap := Map("4","a","5","b","6","c","7","d","8","e","9","f","10","g","11","h","12","i","13","j","14","k","15","l","16","m","17","n","18","o","19","p","20","q","21","r","22","s","23","t","24","u","25","v","26","w","27","x","28","y","29","z","30","1","31","2","32","3","33","4","34","5","35","6","36","7","37","8","38","9","39","0","40","Enter","41","Escape","42","Backspace","43","Tab","44","Space","45","-","46","=","47","[","48","]","49","\","51",";","52","'","53","\`\`","54",",","55",".","56","/","57","CapsLock","58","F1","59","F2","60","F3","61","F4","62","F5","63","F6","64","F7","65","F8","66","F9","67","F10","68","F11","69","F12", "70", "PrintScreen", "71","ScrollLock","72","Pause","73","Insert","74","Home","75","PgUp","76","Delete","77","End","78","PgDn","79","Right","80","Left","81","Down","82","Up", "83","NumLock","84","NumpadDiv","85","NumpadMult","86","NumpadSub","87","NumpadAdd","88","NumpadEnter","89","Numpad1","90","Numpad2","91","Numpad3","92","Numpad4","93","Numpad5","94","Numpad6","95","Numpad7","96","Numpad8","97","Numpad9","98","Numpad0","99","NumpadDot", "224","LControl","225","LShift","226","LAlt","227","LWin","228","RControl","229","RShift","230","RAlt","231","RWin")
    
    codeStr := "" . code
    if (!keyMap.Has(codeStr))
        return ""
        
    keyName := keyMap[codeStr]
    
    local ignoreNumLock := false
   
    if (deviceName != "" && ProgramData.Has("devices") && ProgramData["devices"].Has(deviceName)) {
        if (ProgramData["devices"][deviceName].Has("ignoreNumLock")) {
            ignoreNumLock := ProgramData["devices"][deviceName]["ignoreNumLock"]
        }
    }
    
    ; Only translate the keys if the OS NumLock is OFF *AND* this keyboard isn't ignoring it
    if (!ignoreNumLock && !GetKeyState("NumLock", "T")) {
        if (keyName = "Numpad1")
            return "NumpadEnd"
        if (keyName = "Numpad2")
            return "NumpadDown"
        if (keyName = "Numpad3")
            return "NumpadPgDn"
        if (keyName = "Numpad4")
            return "NumpadLeft"
        if (keyName = "Numpad5")
            return "NumpadClear"
        if (keyName = "Numpad6")
            return "NumpadRight"
        if (keyName = "Numpad7")
            return "NumpadHome"
        if (keyName = "Numpad8")
            return "NumpadUp"
        if (keyName = "Numpad9")
            return "NumpadPgUp"
        if (keyName = "Numpad0")
            return "NumpadIns"
        if (keyName = "NumpadDot")
            return "NumpadDel"
    }
    
    
    return keyName
}

KiBox(Text, Title := "SideKI Macro") {
    MsgGui := Gui("+AlwaysOnTop", Title)
    MsgGui.SetFont("s10", "Segoe UI")
    MsgGui.Add("Text", "w300 Center", Text)
    MsgGui.Add("Button", "w80 h30 x110 Default", "OK").OnEvent("Click", (g, *) => g.Gui.Destroy())
    MsgGui.Show("NoActivate") ; NoActivate keeps focus on your current app
    return MsgGui
}

; --- 5. EXIT LOGIC ---
ExitFunc(*) {
    Send("{Blind}{LCtrl Up}{RCtrl Up}{LAlt Up}{RAlt Up}{LShift Up}{RShift Up}{LWin Up}{RWin Up}")
    for keyName, _ in activeKeys {
        Send("{Blind}{" . keyName . " Up}")
    }
}
OnExit(ExitFunc)

Return 
`;     

// REPLACE your existing generateAhkScriptDriver function with this one.
function generateAhkScriptDriver() {

    // --- HELPER FUNCTIONS and DATA PREPARATION (UNCHANGED) ---
    const sanitizeForFuncName = (name) => {
        const specialCharsMap = {
            '`': 'Backtick', '-': 'Hyphen', '=': 'Equals', '[': 'LBracket', ']': 'RBracket',
            '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period',
            '/': 'Slash', ' ': 'Space'
        };
        if (specialCharsMap[name]) return specialCharsMap[name];
        const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
        return sanitized || 'unnamed';
    };

    const parseAhkHotkey = (hotkeyString) => {
        if (!hotkeyString) return null;
        let key = hotkeyString.toUpperCase();
        const result = { ctrl: false, alt: false, shift: false };
        if (key.includes('^')) { result.ctrl = true; key = key.replace(/\^/g, ''); }
        if (key.includes('!')) { result.alt = true; key = key.replace(/!/g, ''); }
        if (key.includes('+')) { result.shift = true; key = key.replace(/\+/g, ''); }
        result.key = key.trim();
        if (result.key === "`") { result.key = "``"; }
        return result;
    };

    let functionsString = ``;
    let activeProfilesInitString = ``;
    const programDataForAhk = JSON.parse(JSON.stringify(State.data));
    
    for (const devKey in programDataForAhk.devices) {
        const escapedDevKey = devKey.replace(/["`]/g, m => '`' + m);
        activeProfilesInitString += `    ActiveProfiles["${escapedDevKey}"] := Map()\n`;
        
        const programs = programDataForAhk.devices[devKey].programs;
        for (const progKey in programs) {
            const escapedProgKey = progKey.replace(/["`]/g, m => '`' + m);
            const escapedActiveProfile = programs[progKey].activeProfile.replace(/["`]/g, m => '`' + m);

             activeProfilesInitString += `    ActiveProfiles["${escapedDevKey}"]["${escapedProgKey}"] := "${escapedActiveProfile}"\n`;
            
             programs[progKey].cycleHotkeyData = parseAhkHotkey(programs[progKey].cycleHotkey);
            if (programs[progKey].profiles) {
                for (const profKey in programs[progKey].profiles) {
                    const profile = programs[progKey].profiles[profKey];
                    for (const layerKey in profile) {
                        const layer = profile[layerKey];
                        if (typeof layer !== 'object' || layer === null) continue;
                        const newLayerWithUppercaseKeys = {};
                        for (const hotkeyKey in layer) {
                            const hotkey = layer[hotkeyKey];

                            const sanDev = sanitizeForFuncName(devKey);
                            const sanProg = sanitizeForFuncName(progKey);
                            const sanProf = sanitizeForFuncName(profKey);
                            const sanHotkey = sanitizeForFuncName(hotkeyKey);
                            if (hotkey.down && hotkey.down.trim() !== '') {
                                const funcName = `Func_${sanDev}_${sanProg}_${sanProf}_${layerKey}_${sanHotkey}_down`;
                                //const verify = ``
                                functionsString += `${funcName}() {\n${hotkey.down}\n}\n\n`;
                                hotkey.down = funcName;
                            }
                            if (hotkey.up && hotkey.up.trim() !== '') {
                                const funcName = `Func_${sanDev}_${sanProg}_${sanProf}_${layerKey}_${sanHotkey}_up`;
                                functionsString += `${funcName}() {\n${hotkey.up}\n}\n\n`;
                                hotkey.up = funcName;
                            }
                            let standardizedKey = hotkeyKey.toUpperCase();
                            if (standardizedKey === "`") { standardizedKey = "``"; }
                            newLayerWithUppercaseKeys[standardizedKey] = hotkey;
                        }
                        profile[layerKey] = newLayerWithUppercaseKeys;
                    }
                }
            }
            delete programs[progKey].cycleHotkey;
        }
    }

    //Object.values(programDataForAhk).forEach(prog => delete prog.cycleHotkey);
    
    const programDataString = JSON.stringify(programDataForAhk);

    let contextIfChainString = ``;
    const masterPrograms = new Map();
    for (const devKey in programDataForAhk.devices) {
        for (const pKey in programDataForAhk.devices[devKey].programs) {
            masterPrograms.set(pKey, programDataForAhk.devices[devKey].programs[pKey]);
        }
    }
     for (const [progKey, program] of masterPrograms.entries()) {
        if (progKey !== "Global" && program.exeName) {
            //const program = programDataForAhk[progKey];
            
            const prefix = contextIfChainString === '' ? 'if' : 'else if';
            const titlePart = program.windowTitle ? program.windowTitle.replace(/["`]/g, m => '`' + m) + " " : "";
            const exeName = program.exeName.replace(/["`]/g, m => '`' + m);
            const escapedProgKey = progKey.replace(/["`]/g, m => '`' + m);
            contextIfChainString += `    ${prefix} (WinActive("${titlePart}ahk_exe ${exeName}"))\n`;
            contextIfChainString += `    {\n`;
            contextIfChainString += `        currentContext := "${escapedProgKey}"\n`;
            contextIfChainString += `    }\n`;
        }
    }

    // --- SCRIPT ASSEMBLY ---
    const script = `#Requires AutoHotkey v2.0
#SingleInstance Force
SendMode "Input"
#Include "${safeDepsDir}\\Lib\\UISearch.ahk"
#Include "${safeDepsDir}\\Lib\\jsongo.v2.ahk"
SetTitleMatchMode "RegEx"

; --- State and Data (Auto-Generated) ---
global ProgramData := jsongo.Parse('${programDataString.replace(/'/g, "`'")}')
global ActiveProfiles := Map()
${activeProfilesInitString}

; --- Dynamically Generated Functions (Auto-Generated) ---
${functionsString}

${(isUniversalMacros) ? UniversalMacros : ""}

; =====================================================================================
; --- Core Hotkey Logic (Simplified) ---
; =====================================================================================

HandleHotkey(deviceName, keyName, state, activeKeys) {
    local currentContext := "Global"
    ${contextIfChainString}
        
    if (state = "down" && _CheckAndCycleProfile(deviceName, currentContext, keyName, activeKeys))
    {
        return true
    }
    
    if (currentContext != "Global")
    {
        if (_ExecuteHotkeyForContext(deviceName, currentContext, keyName, state, activeKeys))
        {
            return true
        }
    }

    if (_ExecuteHotkeyForContext(deviceName, "Global", keyName, state, activeKeys))
    {
        return true
    }

    return false
}

_ExecuteHotkeyForContext(deviceName, contextName, keyName, state, activeKeys) {
    if (!ProgramData["devices"].Has(deviceName) || !ProgramData["devices"][deviceName]["programs"].Has(contextName))
    {
        return false
    }

     local program := ProgramData["devices"][deviceName]["programs"][contextName]
    local activeProfileName := ActiveProfiles[deviceName][contextName]

    if (!program.Has("profiles") || !program["profiles"].Has(activeProfileName))
    {
        return false
    }

    local profile := program["profiles"][activeProfileName]
    local ctrlHeld := activeKeys.Has("LControl") || activeKeys.Has("RControl")
    local altHeld := activeKeys.Has("LAlt") || activeKeys.Has("RAlt")
    local shiftHeld := activeKeys.Has("LShift") || activeKeys.Has("RShift")
    
    local layerName := ""
    if (ctrlHeld && !altHeld && !shiftHeld) {
        layerName := "ctrl_hotkeys"
    } else if (altHeld && !ctrlHeld && !shiftHeld) {
        layerName := "alt_hotkeys"
    } else if (shiftHeld && !ctrlHeld && !altHeld) {
        layerName := "shift_hotkeys"
    } else if (!ctrlHeld && !altHeld && !shiftHeld) {
        layerName := "hotkeys"
        
    } else {
        return false
    }

    local upperKeyName := StrUpper(keyName)
    if (profile.Has(layerName) && profile[layerName].Has(upperKeyName))
    {
        local hotkeyData := profile[layerName][upperKeyName]
        local action := (state = "down") ? "down" : "up"
        
        if (hotkeyData.Has(action))
        {
            local funcName := hotkeyData[action]
            if (funcName && StrLen(Trim(funcName)) > 0 && Type(%funcName%) = "Func")
            {
                try
                {
                   
                    if(altHeld){
                        Send "{Blind}{vkE8}"
                        SendEvent '{Alt Up}'   
                    }
                    if(shiftHeld)
                        SendEvent '{Shift Up}'
                    if(ctrlHeld)
                        SendEvent '{Ctrl Up}'   

                    %funcName%()

                    if(altHeld){    
                        Send '{Alt Down}'
                        Send "{Blind}{vkE8}"
                    }
                    if (ctrlHeld)
                        SendEvent "{Ctrl Down}" 
                    if (shiftHeld)
                        SendEvent "{Shift Down}"
                }
                catch as e
                {
                    ShowProfileToast("Hotkey Error: " . funcName, "Error")
                }
            }
        }
        return true ; A hotkey definition was found, consume the keypress.
    }
    return false
}

_CheckAndCycleProfile(deviceName, contextName, keyName, activeKeys) {
    _TestCycle(devName, progName) {
        
    if (!ProgramData["devices"].Has(devName) || !ProgramData["devices"][devName]["programs"].Has(progName))
        {
             return false
        }
         local program := ProgramData["devices"][devName]["programs"][progName]

        if (!program.Has("cycleHotkeyData") || !program["cycleHotkeyData"])
        {
            return false
        }
        local cycleData := program["cycleHotkeyData"]
        local upperKeyName := StrUpper(keyName)
        if (cycleData["key"] != upperKeyName)
        {
            return false
        }
        local ctrlHeld := activeKeys.Has("LControl") || activeKeys.Has("RControl")
        local altHeld := activeKeys.Has("LAlt") || activeKeys.Has("RAlt")
        local shiftHeld := activeKeys.Has("LShift") || activeKeys.Has("RShift")
        if (cycleData["ctrl"] != ctrlHeld || cycleData["alt"] != altHeld || cycleData["shift"] != shiftHeld)
        {
            return false
        }
        local profileNames := []
        if (program.Has("profiles"))
        {
            for name, _ in program["profiles"]
            {
                profileNames.Push(name)
            }
        }
        if (profileNames.Length > 1)
        {
            local activeProfileName := ActiveProfiles[devName][progName]
            local currentIndex := -1
            for i, name in profileNames
            {
                if (name == activeProfileName)
                {
                    currentIndex := i
                    break
                }
            }
            local nextIndex := Mod(currentIndex, profileNames.Length) + 1
            ActiveProfiles[devName][progName] := profileNames[nextIndex]
            local displayName := program.Has("displayName") ? program["displayName"] : progName
            ShowProfileToast(displayName . " -> " . profileNames[nextIndex])
        }
        return true
    }
    if (contextName != "Global" && _TestCycle(deviceName, contextName))
    {
        return true
    }
    return _TestCycle(deviceName, "Global")
}

ShowProfileToast(profileText, title := "Profile Changed") {
    try
    {
        ToastGui := Gui("+AlwaysOnTop -Caption +ToolWindow", title)
        ToastGui.BackColor := "E6E6EE"
        ToastGui.SetFont("s18 c1A1A1A", "Segoe UI")
        ToastGui.Add("Text", "w300 Center", profileText)
        ToastGui.Show("NoActivate")
        SetTimer(() => ToastGui.Destroy(), -2000)
    }
}


global ActiveToasts := []


ShowToast(profileText, title := "Status", hasTimer := true) {
    global ActiveToasts
    
    ; 1. Prevent screen flooding (limit to 5)
    if (ActiveToasts.Length >= 5) {
        oldest := ActiveToasts.RemoveAt(1)
        oldest.Destroy()
    }

    try {
        local ToastGui := Gui("+AlwaysOnTop -Caption +ToolWindow", title)
        ToastGui.BackColor := "1E1E1E" 
        ToastGui.SetFont("s16 cF0F0F0 Bold", "Segoe UI") 
        local textCtrl := ToastGui.Add("Text", "w450 Center", profileText)
        textCtrl.Margin := "0, 2"
        
        ; Pre-calculate size
        ToastGui.Show("NoActivate Hide")
        local w, h
        ToastGui.GetPos(,, &w, &h)
        
        ; 2. Calculate Stacking Position
        local xPos := (A_ScreenWidth - w) / 2
        local baseY := A_ScreenHeight - 60
        
        ; Each new toast moves UP by (Height + 10px gap) per active toast
        local stackOffset := (ActiveToasts.Length) * (h + 10)
        local yPos := baseY - h - stackOffset

        WinSetTransparent(180, ToastGui)
        ToastGui.Show("NoActivate x" . xPos . " y" . yPos)
        
        ; Add to tracker
        ActiveToasts.Push(ToastGui)

        ; 3. Auto-Cleanup
        if (hasTimer) {
            ; We use a fat-arrow function to call the cleanup helper
            SetTimer(() => _RemoveToastFromStack(ToastGui), -2000)
        }
    }
}

; Helper to remove the GUI from the global tracking array when it dies
_RemoveToastFromStack(guiObj) {
    global ActiveToasts
    for index, activeObj in ActiveToasts {
        if (activeObj == guiObj) {
            ActiveToasts.RemoveAt(index)
            break
        }
    }
    guiObj.Destroy()
}


`;
    return script;
}






function isProcessRunning(processName) {
  return new Promise((resolve, reject) => {
    exec("tasklist", (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.toLowerCase().includes(processName.toLowerCase()));
    });
  });
}





// === PRECISE CHANGE: This is the new Process Manager ===
async function runOrReloadScript(isDriver = false) {
    const statusMsg = document.getElementById("status-message");

    // 1. If an old AHK script is running, kill it cleanly.
    if (ahkProcess) {
        ahkProcess.kill();
        ahkProcess = null;
    }

    // This is now our ONLY stop logic for the AHK script itself
    if (!isDriver) { // If the user just wanted to stop, we're done.
        statusMsg.textContent = "Script stopped.";
        return;
    }
    
    // 2. Save the latest config files
    await saveSettings();
    
    statusMsg.textContent = "Starting driver script...";

    // 3. Spawn AHK with pipes for stdin and stdout
    try {
        ahkProcess = spawn(AHK_EXE_PATH, [AHK_SERVER_SCRIPT_PATH], {
            detached: false, // Must be false for pipes to work
            stdio: ['pipe', 'pipe', 'ignore'], // Create pipes for [stdin, stdout, stderr]
            cwd: DEPS_DIR,
        });

        // === PRECISE CHANGE: Listen for AHK's initial lock state broadcast ===
        ahkProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`[AHK STDOUT]: ${message}`);

            try {
                const parsed = JSON.parse(message);
                if (parsed.type === "syncLocks") {
                    // Pass the OS states directly into the driver
                    MacroDriver.setLockStates({
                        caps: parsed.caps,
                        num: parsed.num,
                        scroll: parsed.scroll
                    });
                }
            } catch (e) {
                // Not JSON or different message, ignore
            }
        });

        ahkProcess.on('close', (code) => {
            // === PRECISE CHANGE: Ignore Code 0 (Clean exit) or null ===
            if (ahkProcess && code !== 0 && code !== null) { 
                console.error(`AHK script process exited with code ${code}`);
                ahkProcess = null;
            }
        });

        // 4. Start the USB Driver (which will now send data via this process)
        const targetKeyboards = Object.keys(State.data.devices).map(devName => ({
            name: devName, 
            vendor: "0x" + State.data.devices[devName].vendor, 
            prod: "0x" + State.data.devices[devName].prod,
            ignoreNumLock : State.data.devices[devName].ignoreNumLock,
        }));

        if (MacroDriver.isRunning) {
            await MacroDriver.stop(); 
        }
        MacroDriver.start(targetKeyboards);

        isEnabled = true;
        statusMsg.textContent = "Driver running.";
        statusMsg.style.color = "green";

    } catch (e) {
        statusMsg.textContent = "Failed to start AHK process.";
        statusMsg.style.color = "red";
    }
}


function setupEventListeners() {
    const profileEditorContainer = document.getElementById("profile-editor-container");
    
    //Numpad Switch

    const switchButton = document.getElementById('keyboard-view-switch');
    const qwertyView = document.getElementById('qwerty-keyboard');
    const numpadView = document.getElementById('numpad-keyboard');
    //const reorderUpBtns = document.querySelectorAll('.reorder-btn');
    

    if (switchButton) { // Good practice to check if the element exists
        switchButton.addEventListener('click', () => {
            const isNumpadVisible = numpadView.style.display !== 'none';
            if (isNumpadVisible) {
                numpadView.style.display = 'none';
                qwertyView.style.display = 'block';
               // switchButton.textContent = 'Switch to Numpad';
            } else {
                numpadView.style.display = 'grid';
                qwertyView.style.display = 'none';
                //switchButton.textContent = 'Switch to Keyboard';
            }
        });
    }
    

    
    const mappingProfileSelect = document.getElementById("mapping-profile-select");

    profileEditorContainer.addEventListener("input", (e) => {
        if (e.target.id !== "script-editor-down" && e.target.id !== "script-editor-up") {
            const currentProgram = State.getCurrentProgram();
            if (!currentProgram) return;

            switch (e.target.id) {
                case "window-title-input":
                    if (State.selection.programName !== "Global") currentProgram.windowTitle = e.target.value;
                    runAllValidations();
                    break;
                case "cycle-hotkey-input":
                    currentProgram.cycleHotkey = e.target.value;
                    runAllValidations();
                    updateKeyboardVisuals();
                    break;
                case "path-input":
                    currentProgram.path = e.target.value;
                    break;
            }
            return;
        }

    });

    // --- The single, reusable function that does all the work ---
    function syncModelWithEditors() {
        // 1. Guard clauses: a cleaner way to handle initial checks
        if (!State.selection.keyName) return;

        
        const downScript = editorDown.getValue();
        const upScript = editorUp.getValue();

        State.setKeyData(State.selection.keyName, downScript, upScript);


        updateKeyboardVisuals();
    }


    // --- Attach the SAME function to BOTH editors' "change" event ---
    
    editorDown.on("change", syncModelWithEditors);
    editorUp.on("change", syncModelWithEditors);

    document.getElementById("add-program-btn").addEventListener("click", async () => {
        const filePath = await ipcRenderer.invoke("show-open-dialog", {
            title: "Select Program Executable",
            buttonLabel: "Add Program",
        });
        if (filePath) {
            const exeName = path.basename(filePath);
            let progName = exeName.replace(".exe", "").replace(/[\s()]/g, "");
            if (!progName) progName = "Program";
            let counter = 2;
            let originalName = progName;

            const programsRef = State.data.devices[State.selection.deviceName].programs;
            while (programsRef[progName]) {
                progName = `${originalName}_${counter++}`;
            }
            programsRef[progName] = {
                displayName: progName,
                path: filePath,
                exeName: exeName,
                windowTitle: "",
                activeProfile: "Default",
                cycleHotkey: "",
                profiles: { Default: { hotkeys: {} } },
            };
            State.selectProgram(progName);  

            renderUI();
        }
    });

    document.getElementById("program-list").addEventListener("click", (e) => {
        const programItem = e.target.closest(".program-item");
        if (!programItem) return;
        const programNameToHandle = programItem.dataset.programName;
        if (e.target.closest(".delete-btn") 
        
        ) {
            
            e.stopPropagation();
            (async () => {
                const confirmed = await ipcRenderer.invoke("show-confirm-dialog", {
                    title: "Delete Program Profile",
                    message: `Are you sure you want to delete the program profile for "${programNameToHandle}"?`,
                });
                if (confirmed) {
                    const currDevice = State.selection.deviceName;
                    delete State.data.devices[currDevice].programs[programNameToHandle];
                    State.selection.programName = "Global";
                    renderUI();
                }
            })();
        } 
        else if (e.target.closest(".reorder-btn")
        ) {
                e.stopPropagation();
               
                const programItem = e.target.closest(".program-item");
                if (!programItem) return;

                const prevSibling = programItem.previousElementSibling;

                if(!prevSibling) return;

                const prevSiblingName = prevSibling.getAttribute("data-program-name");
                
                if (prevSiblingName !== "Global") {
                   
                    const programItemName = programItem.getAttribute("data-program-name");
                    const currPrograms = State.data.devices[State.selection.deviceName].programs;

                    const newProgramProfiles = {};
                    for(const programName in currPrograms) {
                        if(programName === prevSiblingName) newProgramProfiles[programItemName] = currPrograms[programItemName];         
                        else if(programName === programItemName) newProgramProfiles[prevSiblingName] = currPrograms[prevSiblingName]          
                        else newProgramProfiles[programName] = currPrograms[programName];
                    }
                    
                    
                    State.data.devices[State.selection.deviceName].programs = newProgramProfiles;
                    const moveHeight = prevSibling.offsetHeight + 5;

                    document.documentElement.style.setProperty('--moveValue', `${moveHeight}px`);
                   
                    prevSibling.classList.add("moving-down");
                    programItem.classList.add("moving-up");
                    
                    setTimeout(() =>{
                     
                       prevSibling.classList.remove("moving-down");
                       programItem.classList.remove("moving-up");

                       
                       renderUI();
                       
                    }, 210);

                    
                      
                  

                  
                }
        }
        else {
             if (State.selection.programName !== programNameToHandle) {
                State.selectProgram(programNameToHandle);
                renderUI();
            }
        }
        
    });

    document.getElementById("add-process-btn").addEventListener("click", showProcessList);

    const modal = document.getElementById("process-modal");
    const modalProcessList = document.getElementById("modal-process-list");
    document.getElementById("modal-close-btn").addEventListener("click", () => {
        modal.style.display = "none";
    });
    modalProcessList.addEventListener("click", async (e) => {
        const processItem = e.target.closest(".process-item");
        if (!processItem) return;
        const exeName = processItem.dataset.exeName;
        const loader = document.getElementById("modal-loader");
        loader.textContent = `Resolving path for ${exeName}...`;
        loader.style.display = "block";
        try {
            let filePath = "Path not found";
            if (process.platform === "win32") {
                const stdout = await new Promise((resolve, reject) => {
                    exec(`wmic process where "name='${exeName}'" get ExecutablePath`, (err, stdout) => {
                        if (err) return reject(err);
                        resolve(stdout);
                    });
                });
                const pathLine = stdout.split("\n")[1];
                if (pathLine) filePath = pathLine.trim();
            }
            if (filePath !== "Path not found") {
                let progName = exeName.replace(".exe", "").replace(/[\s()]/g, "");
                if (!progName) progName = "Program";
                
                const programsRef = State.data.devices[State.selection.deviceName].programs;

                let counter = 2;
                let originalName = progName;
                

                while (programsRef[progName]) {
                    progName = `${originalName}_${counter++}`;
                }
                programsRef[progName] = {
                  displayName: progName,
                  path: filePath,
                  exeName: exeName,
                  windowTitle: "",
                  activeProfile: "Default",
                  cycleHotkey: "",
                  profiles: { Default: { hotkeys: {} } },
                };
                State.selectProgram(progName);
                renderUI();
                modal.style.display = "none";
            } else {
                alert(`Could not resolve the full path for ${exeName}. You may need to add it manually.`);
            }
        } catch (error) {
            alert(`Error getting path: ${error.message}`);
        } finally {
            loader.style.display = "none";
            loader.textContent = "Loading...";
        }
    });

    //document.getElementById("run-btn").addEventListener("click", () => runOrReloadScript());
    document.getElementById("run-driver-btn").addEventListener("click", () => runOrReloadScript(true));
    document.getElementById("stop-all-btn").addEventListener("click", stopAllProcesses);
    document.getElementById("config-folder-btn").addEventListener("click", async (e) => {
        await exec(`explorer.exe ${USER_CONFIG_DIR}`);
    });
    document.getElementById("config-file-btn").addEventListener("click", async (e) =>{
        await exec(`code ${AHK_CONFIG_SCRIPT_PATH}`);
        const child = spawn("code", [AHK_CONFIG_SCRIPT_PATH], {
            detached: true,
            stdio: "ignore", // Don't link the input/output to our app
            cwd: DEPS_DIR, // Set the correct working directory
            });

        child.unref()

    });
    document.getElementById("universal-macros-btn").addEventListener("click", async (e) =>{
        await exec(`code ${UNIVERSAL_MACROS_PATH}`);
    });
    

    
    programListNode.addEventListener("dblclick", (e) => {
        const programItem = e.target.closest(".program-item");
        if (!programItem) return;
        const progName = programItem.dataset.programName;
        if (progName === "Global") return;
        const nameWrapper = programItem.querySelector(".program-name-wrapper");
        const renameInput = programItem.querySelector(".program-rename-input");
        if (renameInput.classList.contains("editing")) return;
        nameWrapper.style.display = "none";
        renameInput.classList.add("editing");
        setTimeout(() => {
            renameInput.focus();
            renameInput.select();
        }, 16);
        const finishEdit = () => {
            const newName = renameInput.value.trim();
            
            const currentPrograms = State.data.devices[State.selection.deviceName].programs;
            if (newName) {
                currentPrograms[progName].displayName = newName;
                const displayNameSpan = nameWrapper.querySelector(".program-display-name");
                const internalNameSpan = nameWrapper.querySelector(".program-internal-name");
                displayNameSpan.textContent = newName;
                internalNameSpan.textContent = newName !== progName ? ` [${progName}]` : "";
            }
            renameInput.classList.remove("editing");
            nameWrapper.style.display = "";
        };
        renameInput.addEventListener("blur", finishEdit, { once: true });
        renameInput.addEventListener("keydown", (keyEvent) => {
            if (keyEvent.key === "Enter" || keyEvent.key === "Escape") {
                renameInput.blur();
            }
        }, { once: true });
    });

    profileEditorContainer.addEventListener("click", async (e) => {
        const target = e.target;
        const currentProgram = State.getCurrentProgram();
        if (!currentProgram) return;
        const keyDiv = target.closest(".keyboard-key");
        if (keyDiv) {

            if (keyDiv.classList.contains('disabled')) {
              return; // If the key is disabled, do nothing and exit the function.
            }
            const keyName = keyDiv.dataset.keyName; 
            
            if (keyName === 'LShift' || keyName === 'LControl' || keyName === 'LAlt') {
                State.toggleModifier(keyName);
            } else {
                State.selection.keyName = keyName;
            }
            renderProfileDetails();
            updateKeyboardVisuals();
            if (!editorDown.getOption("readOnly")) {
             editorDown.focus();
}
            return;
        }
        switch (target.id) {
          case "add-profile-btn":
            const newProfileName = (await Swal.fire({
              title: "Enter new profile name",
              input: "text",
              inputLabel: "Profile Name",
              inputValue: "", // Optional default value
              showCancelButton: true,
              // Simple validation: don't allow empty names
              inputValidator: (value) => {
                if (!value) {
                  return "You need to write something!";
                }
              },
            })).value;

            if (newProfileName) {
              if (!currentProgram.profiles[newProfileName]) {
                currentProgram.profiles[newProfileName] = { hotkeys: {} };
                currentProgram.activeProfile = newProfileName;
                State.selection.keyName = null;
                renderUI();
              } else {
                 Swal.fire(`Profile "${newProfileName}" already exists.`);
              }
            }
            break;
          case "delete-profile-btn":
            (async () => {
              const profileSelect = document.getElementById(
                "mapping-profile-select"
              );
              const profileToDelete = profileSelect.value;
              if (profileToDelete !== "Default") {
                const confirmed = await ipcRenderer.invoke(
                  "show-confirm-dialog",
                  {
                    title: "Delete Profile",
                    message: `Are you sure you want to delete the profile "${profileToDelete}"?`,
                    detail: "This action cannot be undone.",
                  }
                );
                if (confirmed) {
                  delete currentProgram.profiles[profileToDelete];
                  currentProgram.activeProfile = "Default";
                  State.selection.keyName = null;
                  renderUI();
                }
              }
            })();
            break;
          case "change-path-btn":
            (async () => {
              const filePath = await ipcRenderer.invoke("show-open-dialog", {
                title: "Change Program Path",
                buttonLabel: "Select New Path",
              });
              if (filePath) {
                if (currentProgram) {
                  currentProgram.path = filePath;
                  currentProgram.exeName = path.basename(filePath);
                  renderProfileDetails();
                  runAllValidations();
                }
              }
            })();
            break;
        }
    });

    profileEditorContainer.addEventListener("change", (e) => {
        const target = e.target;
        const currentProgram = State.getCurrentProgram();

        if (!currentProgram) return;
        switch (target.id) {
            case "mapping-profile-select":
                currentProgram.activeProfile = target.value;
                State.selection.keyName = null;
                renderProfileDetails();
                updateKeyboardVisuals();
                break;
            case "enable-cycle-hotkey":
                document.getElementById("cycle-hotkey-input").disabled = !target.checked;
                if (!target.checked) {
                    document.getElementById("cycle-hotkey-input").value = "";
                    currentProgram.cycleHotkey = "";
                }
                runAllValidations();
                updateKeyboardVisuals();
                break;
        }
    });
    
    
    
    document.getElementById("save-btn").addEventListener("click", () => saveSettings());
}




 const saveSettings = async () => {
        
        await loadUniversalMacros();
        const statusMsg = document.getElementById("status-message");
        statusMsg.textContent = "Saving...";
        statusMsg.style.color = "black";
        try {
            await fs.mkdir(USER_CONFIG_DIR, { recursive: true });
            await fs.writeFile(SETTINGS_JSON_PATH, JSON.stringify(State.data, null, 2), "utf8");
            //const generation = generateAhkScript();
            const generationDriver = generateAhkScriptDriver();
          
            //await fs.writeFile(AHK_SCRIPT_PATH, generation, "utf8");
           
            await fs.writeFile(AHK_SERVER_SCRIPT_PATH, serverAHKScript, "utf8");
            
            await fs.writeFile(AHK_CONFIG_SCRIPT_PATH, generationDriver, "utf8");
            

            statusMsg.textContent = "Settings saved and AHK script generated successfully!";
            statusMsg.style.color = "green";
        } catch (err) {
            statusMsg.textContent = `Error: ${err.message}`;
            statusMsg.style.color = "red";
        }
    }

// ================================================================= //
//                      APPLICATION STARTUP                          //
// ================================================================= //

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  initialize();



  ipcRenderer.on("global-shortcut-triggered", (event, action) => {
    
    if (action === "toggle-run-stop") {
      if (!isEnabled) {
        document.getElementById("run-driver-btn").click();
        // The old toast opened a new window, which is more complex in Electron.
        // For now, let's just log it or update the status bar.
        ipcRenderer.send("show-toast", "Enabled", "lightgreen", 500);
      } else {
        document.getElementById("stop-all-btn").click();
        ipcRenderer.send("show-toast", "Disabled", "lightcoral", 500);
      }
    }
    if (action === "toggle-reload") {
         ipcRenderer.send("show-toast", "Reloading...", "lightblue", 500);
        document.getElementById("run-driver-btn").click();  
    }
  });
});



ipcRenderer.on("clean-close", async () => {

  await stopAllProcesses();
});

ipcRenderer.on("toast", async () =>{
    console.log("EMISSION WORKS!!!");
});



// --- In your script.js, replace the old list with this one ---

const ahkKeywords = [
    // --- Statement Keywords ---
    'class', 'static', 'super', 'try', 'catch', 'finally', 'throw', 'return', 'Break', 'Continue', 'Critical', 
    'Exit', 'ExitApp', 'Gosub', 'Goto', 'New', 'OnExit', 'Pause', 'SetBatchLines', 'SetTimer', 'Suspend', 'Thread', 'Until', 'as',

    // --- Control Flow Keywords ---
    'If', 'Else', 'For', 'In', 'While', 'Loop', 'Switch',

    // --- Directives ---
    '#Requires', '#Include', '#Warn', '#HotIf', '#HotIfTimeout', '#NoTrayIcon', '#UseHook',

    // --- Literals & Special ---
    'true', 'false', 'this',

    // --- Common Built-in Functions ---
    'Abs', 'ACos', 'ASin', 'ATan', 'CallbackCreate', 'CallbackFree', 'Ceil', 'Chr', 'Click', 'ClipWait',
    'ComCall', 'ComObjActive', 'ComObjGet', 'ComObjValue', 'ControlClick', 'ControlSend', 'ControlGetText',
    'CoordMode', 'Cos', 'DateAdd', 'DateDiff', 'DirCopy', 'DirCreate', 'DirDelete', 'DirExist', 'DirMove',
    'DllCall', 'Download', 'DriveGetList', 'EnvGet', 'EnvSet', 'Exit', 'ExitApp', 'Exp', 'FileAppend',
    'FileCopy', 'FileDelete', 'FileEncoding', 'FileExist', 'FileGetAttrib', 'FileGetSize', 'FileGetTime',
    'FileGetVersion', 'FileMove', 'FileOpen', 'FileRead', 'FileRecycle', 'FileSelect', 'FileSetAttrib',
    'FileSetTime', 'Floor', 'Format', 'FormatTime', 'GetKeyName', 'GetKeyState', 'GroupActivate', 'GroupAdd',
    'GroupClose', 'GuiCtrlFromHwnd', 'GuiFromHwnd', 'HasBase', 'HasMethod', 'HasProp', 'Hotkey', 'Hotstring',
    'ImageSearch', 'IniDelete', 'IniRead', 'IniWrite', 'InputBox', 'InStr', 'IsAlnum', 'IsAlpha', 'IsDigit',
    'IsFloat', 'IsInteger', 'IsLabel', 'IsLower', 'IsNumber', 'IsObject', 'IsSetRef', 'IsSpace', 'IsTime',
    'IsUpper', 'IsXDigit', 'KeyHistory', 'KeyWait', 'ListHotkeys', 'ListLines', 'ListVars', 'Ln', 'Log', 'LTrim',
    'Max', 'MenuSelect', 'Min', 'Mod', 'MonitorGet', 'MonitorGetCount', 'MouseClick', 'MouseClickDrag', 'MouseGetPos',
    'MouseMove', 'MsgBox', 'NumGet', 'NumPut', 'ObjAddRef', 'ObjBindMethod', 'ObjRelease', 'OnClipboardChange',
    'OnError', 'OnExit', 'OnMessage', 'Ord', 'OutputDebug', 'Pause', 'Persistent', 'PixelGetColor', 'PixelSearch',
    'PostMessage', 'ProcessClose', 'ProcessExist', 'ProcessSetPriority', 'ProcessWait', 'ProcessWaitClose',
    'Random', 'RegDelete', 'RegExMatch', 'RegExReplace', 'RegRead', 'RegWrite', 'Reload', 'Round', 'RTrim',
    'Run', 'RunAs', 'RunWait', 'Send', 'SendEvent', 'SendInput', 'SendMessage', 'SendMode', 'SendText',
    'SetCapslockState', 'SetKeyDelay', 'SetTimer', 'SetTitleMatchMode', 'SetWinDelay', 'SetWorkingDir', 'Shutdown',
    'Sin', 'Sleep', 'Sort', 'SoundBeep', 'SoundPlay', 'SplitPath', 'Sqrt', 'StatusBarGetText', 'StatusBarWait',
    'StrCompare', 'StrGet', 'StrLen', 'StrLower', 'StrReplace', 'StrSplit', 'StrUpper', 'SubStr', 'Suspend',
    'SysGet', 'Tan', 'Thread', 'ToolTip', 'TraySetIcon', 'TrayTip', 'Trim', 'Type', 'VerCompare', 'WinActivate',
    'WinActive', 'WinClose', 'WinExist', 'WinGetClass', 'WinGetControls', 'WinGetCount', 'WinGetID', 'WinGetList',
    'WinGetPos', 'WinGetText', 'WinGetTitle', 'WinHide', 'WinKill', 'WinMaximize', 'WinMinimize', 'WinMove',
    'WinRestore', 'WinSet', 'WinSetTitle', 'WinShow', 'WinWait', 'WinWaitActive', 'WinWaitClose',

    // --- Built-in Classes ---
    'Array', 'Buffer', 'Class', 'ClipboardAll', 'Enumerator', 'Error', 'File', 'Func', 'Gui', 'InputHook',
    'Integer', 'Map', 'Menu', 'MenuBar', 'Object', 'RegExMatchInfo', 'String', 'VarRef',

    // --- Built-in Variables ---
    'A_AhkPath', 'A_AhkVersion', 'A_Args', 'A_Clipboard', 'A_ComputerName', 'A_ControlDelay', 'A_CoordModeCaret',
    'A_CoordModeMenu', 'A_CoordModeMouse', 'A_CoordModePixel', 'A_CoordModeToolTip', 'A_Cursor', 'A_DD', 'A_DDD',
    'A_DDDD', 'A_DefaultMouseSpeed', 'A_DetectHiddenText', 'A_DetectHiddenWindows', 'A_EndChar', 'A_EventInfo',
    'A_FileEncoding', 'A_Hour', 'A_IconFile', 'A_IconHidden', 'A_IconNumber', 'A_IconTip', 'A_Index',
    'A_Is64bitOS', 'A_IsAdmin', 'A_IsCompiled', 'A_IsCritical', 'A_IsPaused', 'A_IsSuspended', 'A_KeyDelay',
    'A_KeyDuration', 'A_Language', 'A_LastError', 'A_LineFile', 'A_LineNumber', 'A_ListLines', 'A_LoopField',
    'A_MDay', 'A_Min', 'A_MM', 'A_MMM', 'A_MMMM', 'A_Mon', 'A_MouseDelay', 'A_MSec', 'A_MyDocuments', 'A_Now',
    'A_NowUTC', 'A_OSVersion', 'A_PriorHotkey', 'A_PriorKey', 'A_ProgramFiles', 'A_PtrSize', 'A_RegView',
    'A_ScreenDPI', 'A_ScreenHeight', 'A_ScreenWidth', 'A_ScriptDir', 'A_ScriptFullPath', 'A_ScriptHwnd',
    'A_ScriptName', 'A_Sec', 'A_SendLevel', 'A_SendMode', 'A_Space', 'A_Tab', 'A_Temp', 'A_ThisFunc',
    'A_ThisHotkey', 'A_TickCount', 'A_TimeIdle', 'A_TimeSincePriorHotkey', 'A_TimeSinceThisHotkey',
    'A_TitleMatchMode', 'A_TitleMatchModeSpeed', 'A_TrayMenu', 'A_UserName', 'A_WDay', 'A_WinDelay',
    'A_WorkingDir', 'A_YDay', 'A_Year', 'A_YWeek', 'A_YYYY'
];

const addSpaceAfterFunctions = new Set([
    // User's examples:
    'Send', 'Sleep', 'MsgBox',

    // Other common command-like functions:
    'Run', 'ToolTip', 'TrayTip', 'Click', 'MouseMove', 'WinActivate', 'WinClose', 'WinHide', 'WinShow', 'WinKill',
    'WinWait', 'RegRead', 'RegWrite', 'FileAppend', 'FileCopy', 'FileDelete', 'ControlSend', 'ControlClick',

    // Common keywords that are always followed by a space:
    'If', 'Else', 'For', 'While', 'Loop', 'return', 'Until'
]);


// --- 2. THE FINAL HINTER FUNCTION (with the correct reversed priority) ---
const ahkHinter = (editor) => {
    const cursor = editor.getCursor();
    const token = editor.getTokenAt(cursor);

    // Context check (correct)
    if (token.type && (token.type.includes('string') || token.type.includes('comment'))) {
        return null;
    }

    // Find the word the user is currently typing (correct)
    const currentLine = editor.getLine(cursor.line);
    let wordStart = cursor.ch;
    while (wordStart > 0 && /\w/.test(currentLine.charAt(wordStart - 1))) {
        wordStart--;
    }
    const currentWord = currentLine.slice(wordStart, cursor.ch);

    // Intelligently find suggestions from the code (correct)
    const wordsInCode = new Set();
    for (let i = 0; i < editor.lineCount(); i++) {
        editor.getLineTokens(i).forEach(t => {
            if (t.type && (t.type.includes('variable') || t.type.includes('def'))) {
                const matches = t.string.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g);
                if (matches) matches.forEach(match => wordsInCode.add(match));
            }
        });
    }

    const allPossibleWords = new Set([...ahkKeywords, ...Array.from(wordsInCode)]);

    // Filter the list (correct)
    if (currentWord.length === 0) { return { list: [] }; }
    const suggestions = [];
    allPossibleWords.forEach(word => {
        if (word.toLowerCase().startsWith(currentWord.toLowerCase())) {
            suggestions.push(word);
        }
    });
    
    // "Helpfulness" Check (correct)
    if (suggestions.length === 1 && suggestions[0].toLowerCase() === currentWord.toLowerCase()) {
        return null;
    }

    // --- 3. THE KEY CHANGE: Convert strings to smart objects with YOUR requested logic ---
    const smartSuggestions = suggestions.map(word => {
        // Check our new "add-a-space" exception list.
        if (addSpaceAfterFunctions.has(word)) {
            return { text: word + " " }; // It's an exception, so ADD a space.
        } else {
            return { text: word }; // It's not an exception, so NO space (the default).
        }
    });

    // Return the final list of smart suggestion objects
    return {
        list: smartSuggestions,
        from: CodeMirror.Pos(cursor.line, wordStart),
        to: CodeMirror.Pos(cursor.line, cursor.ch)
    };
};


CodeMirror.registerHelper('hint', 'autohotkey', ahkHinter);

const bro = "test";


