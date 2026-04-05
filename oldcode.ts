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


const defaultData = {
  Global: {
    displayName: "Global",
    activeProfile: "Default",
    cycleHotkey: "",
    profiles: {
        
      Default: {
        hotkeys: { 
            '1': {
                down : `; Command Title
MsgBox("This is the default Global profile.")`,
                up: '' 
            }
        },
      },
    },
  },
};


let programProfiles = {};
let selectedProgramName = "Global";
let selectedKeyName = null;
let isEnabled = false;
let activeModifier = null;

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
    programProfiles = JSON.parse(fileContent);
    // --- THIS IS THE "UPGRADE AT LOAD TIME" LOGIC ---
    for (const progName in programProfiles) {
      const program = programProfiles[progName];
      if (program.profiles) {
        for (const profName in program.profiles) {
          const profile = program.profiles[profName];
          if (profile.hotkeys) {
            for (const keyName in profile.hotkeys) {
              const hotkeyData = profile.hotkeys[keyName];
              // If the data is not in the final { down, up } format, upgrade it.
              if (
                typeof hotkeyData !== "object" ||
                !hotkeyData.hasOwnProperty("down")
              ) {
                const newData = { down: "", up: "" };
                if (typeof hotkeyData === "string") {
                  newData.down = hotkeyData;
                } else if (hotkeyData && hotkeyData.triggerOn === "up") {
                  newData.up = hotkeyData.script;
                } else if (hotkeyData && hotkeyData.triggerOn === "down") {
                  newData.down = hotkeyData.script;
                }
                profile.hotkeys[keyName] = newData; // Overwrite old data with upgraded data
              }
            }
          }
        }
      }
    }
    // --- END OF UPGRADE LOGIC ---
  } catch (err) {
    programProfiles = defaultData;
  }
  renderUI();
}

function renderUI() {
    
  renderProgramList();
  renderProfileDetails();
  updateKeyboardVisuals();
}

const stopAllProcesses = async () => {
  const statusMsg = document.getElementById("status-message");
  statusMsg.textContent = "Attempting to stop all processes...";
  statusMsg.style.color = "black";

  const ahkExeName = path.basename(AHK_EXE_PATH);

  // Helper function to kill a process and report its status
  const killProcess = (exeName) => {
    return new Promise((resolve) => {
      exec(`taskkill /IM "${exeName}"`, (error, stdout, stderr) => {
        console.log("Trying to kill task..." + exeName);
        if (error) {
          // If the process wasn't found, it's not an error for us.
          if (stderr && stderr.toLowerCase().includes("not found")) {
            resolve({ name: exeName, status: "not_running" });
          } else {
            resolve({
              name: exeName,
              status: "error",
              message: stderr || error.message,
            });
          }
        } else {
          resolve({ name: exeName, status: "closed" });
        }
      });
    });
  };

  // Run both kill commands in parallel and wait for them to finish
  const results = await Promise.all([killProcess(ahkExeName)]);

  const closedProcs = results
    .filter((r) => r.status === "closed")
    .map((r) => r.name.replace(".exe", ""));
  const errorProcs = results.filter((r) => r.status === "error");

  if (errorProcs.length > 0) {
    statusMsg.textContent = `Error stopping ${errorProcs[0].name}: ${errorProcs[0].message}`;
    statusMsg.style.color = "red";
  } else if (closedProcs.length === 0) {
    statusMsg.textContent = "All relevant processes were already stopped.";
    statusMsg.style.color = "green";
  } else {
    statusMsg.textContent = `Successfully closed: ${closedProcs.join(" & ")}.`;
    statusMsg.style.color = "green";
  }
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
    const programListDiv = document.getElementById('program-list');
    const template = document.getElementById('program-item-template');
    programListDiv.innerHTML = '';

    for (const progName in programProfiles) {
        const program = programProfiles[progName];
        
        const clone = template.content.cloneNode(true);
        const item = clone.querySelector('.program-item');
        const iconImg = clone.querySelector('.program-list-icon');
        const displayNameSpan = clone.querySelector('.program-display-name');
        const internalNameSpan = clone.querySelector('.program-internal-name');
        const renameInput = clone.querySelector('.program-rename-input');
        const deleteBtn = clone.querySelector('.delete-btn');

        item.dataset.programName = progName;
        if (progName === selectedProgramName) {
            item.classList.add('selected');
        }

        // The new logic with the special case for Global

        // --- START: Icon Logic ---
        if (progName === 'Global') {
            // If it's the Global profile, use the local global.png file.
            iconImg.src = './global.png'; 
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

        programListDiv.appendChild(clone);
    }
}
// In script.js, REPLACE your entire renderProfileDetails function with this new one:

// REPLACE your entire renderProfileDetails function with this one:

// REPLACE this entire function in script.js
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

    const currentProgram = programProfiles[selectedProgramName];
    if (!currentProgram) return;

    currentProgramNameSpan.textContent = currentProgram.displayName || selectedProgramName;

    if (selectedProgramName === "Global") {
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
    const currentProfile = currentProgram.profiles[currentProfileName];

    // Determine which hotkey map to READ from based on the active modifier
    let hotkeyMap;
    if (currentProfile) {
        switch (activeModifier) {
            case 'LShift':   hotkeyMap = currentProfile.shift_hotkeys || {}; break;
            case 'LControl': hotkeyMap = currentProfile.ctrl_hotkeys  || {}; break;
            case 'LAlt':     hotkeyMap = currentProfile.alt_hotkeys   || {}; break;
            default:         hotkeyMap = currentProfile.hotkeys       || {};
        }
    } else {
        hotkeyMap = {};
    }

    currentKeyNameSpanDown.textContent = selectedKeyName || "None";

   // Assume editorDown and editorUp are the CodeMirror instances from the previous example

    if (selectedKeyName) {
        // Enable the editors
        editorDown.setOption("readOnly", false);
        editorUp.setOption("readOnly", false);

        const hotkeyData = hotkeyMap[selectedKeyName]; // Read from your map

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
    const currentProfileName = profileSelect.value;
    const currentProgram = programProfiles[selectedProgramName];
    
    const currentProfile = currentProgram ? currentProgram.profiles[currentProfileName] : null;
    if (!currentProfile) {
        document.querySelectorAll(".keyboard-key").forEach(keyDiv => {
            keyDiv.classList.remove("assigned", "editing", "reserved", "modifier-active", "has-modifier-macro");
        });
        return;
    };

    const baseHotkeys = currentProfile.hotkeys || {};
    const shiftHotkeys = currentProfile.shift_hotkeys || {};
    const ctrlHotkeys = currentProfile.ctrl_hotkeys || {};
    const altHotkeys = currentProfile.alt_hotkeys || {};

    document.querySelectorAll(".keyboard-key").forEach((keyDiv) => {
        const keyName = keyDiv.dataset.keyName;
        keyDiv.classList.remove("assigned", "editing", "reserved", "modifier-active", "has-modifier-macro");

        // --- START: RESTORED AND CORRECTED LOGIC ---

        // 1. Get the hotkey data for the CURRENTLY VISIBLE layer to find its description.
        let hotkeyDataOnThisLayer;
        switch (activeModifier) {
            case 'LShift':   hotkeyDataOnThisLayer = shiftHotkeys[keyName]; break;
            case 'LControl': hotkeyDataOnThisLayer = ctrlHotkeys[keyName];  break;
            case 'LAlt':     hotkeyDataOnThisLayer = altHotkeys[keyName];   break;
            default:         hotkeyDataOnThisLayer = baseHotkeys[keyName];
        }

        // 2. Extract the script from that data and set the description span's text.
        const downScript = hotkeyDataOnThisLayer?.down || "";
        const descriptionSpan = keyDiv.querySelector(".key-description");
        if (descriptionSpan) {
            descriptionSpan.textContent = extractDescriptionFromScript(downScript);
            descriptionSpan.title = descriptionSpan.textContent;
        }

        // --- END: RESTORED AND CORRECTED LOGIC ---

        // 3. Now, proceed with the class assignments.
        if (hotkeyDataOnThisLayer) {
            keyDiv.classList.add("assigned");
        }
        
        let hasMacroOnOtherLayer = false;
        if (activeModifier !== 'LShift' && shiftHotkeys[keyName]) hasMacroOnOtherLayer = true;
        if (activeModifier !== 'LControl' && ctrlHotkeys[keyName]) hasMacroOnOtherLayer = true;
        if (activeModifier !== 'LAlt' && altHotkeys[keyName]) hasMacroOnOtherLayer = true;
        if (activeModifier && baseHotkeys[keyName]) hasMacroOnOtherLayer = true;

        if (hasMacroOnOtherLayer) {
            keyDiv.classList.add("has-modifier-macro");
        }

        if (keyName === activeModifier) {
            keyDiv.classList.add('modifier-active');
        }

        if (isCycleEnabled && cycleHotkey && keyName.toLowerCase() === cycleHotkey) {
            keyDiv.classList.add("reserved");
        }

        if (keyName === selectedKeyName) {
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

  for (const progName in programProfiles) {
    if (progName === "Global") continue;
    const program = programProfiles[progName];
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
  const currentProgram = programProfiles[selectedProgramName];

  for (const profileName in currentProgram.profiles) {
    const profile = currentProgram.profiles[profileName];
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

#SingleInstance Ignore
Persistent
SendMode "Input"

#Include "${safeDepsDir}\\Lib\\_socket.ahk"
#Include "${safeDepsDir}\\Lib\\jsongo.v2.ahk"
#Include "kb-config.ahk"

global activeKeys := Map()
global eventQueue := []
global pressedKeys := Map()



; --- Server, Client Callbacks, and Queue Processor (UNCHANGED) ---
ServerCallback(socket, event, errCode)
{
    if (event = "Accept")
    {
        client := socket.Accept()
        client.cb := ClientCallback
    }
}

ClientCallback(socket, event, errCode)
{
    if (event = "Read")
    {
        buf := socket.Recv()
        if (buf.size = 0)
        {
            return
        }
        data := StrGet(buf, "UTF-8")
        if (StrLen(data) = 0)
        {
            return
        }

        for i, jsonData in StrSplit(data, "\`n", "\`r")
        {
            if (Trim(jsonData) = "")
            {
                
                continue
            }
            try
            {
                parsedJson := jsongo.Parse(jsonData)

    
                if (parsedJson.Has("type"))
                {
                   
                    if (parsedJson["type"] = "keyEvent")
                    {
                        ; This is a key event, push it to the queue for processing.
                        keyEvent := parsedJson
    
                        eventQueue.Push(keyEvent)
                    }
                    else if (parsedJson["type"] = "connectionStatus")
                    {
                        ; This is the connection confirmation. Handle it immediately.
                        ; This is where you can trigger your other action.
                        ShowToast("MacroMyKB Loaded!")
                    }
                }
            }
            catch as e
            {
                ; Log errors, but don't use ToolTip/MsgBox as they cause lag
                FileAppend("JSON PARSE ERROR: " e.Message "\`n", "ahk_error.log")
            }
        }
    }
    else if (event = "Close")
    {
        socket.Close()
    }
}

ProcessEventQueue()
{
    Critical "On"
    if (eventQueue.Length = 0)
    {
        Critical "Off"
        return
    }
    ; Pull the OLDEST event from the queue (First-In, First-Out)
    keyEvent := eventQueue.RemoveAt(1)
    
    ; Now that we have our event in a serialized, orderly fashion, process it.
    ProcessKeyPress(keyEvent)
    Critical "Off"
}


; --- FINAL, ROBUST LOGIC ---
ProcessKeyPress(keyEvent)
{
    global activeKeys, pressedKeys
    keyName := GetKeyNameFromCode(keyEvent["key"])
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
        if (HandleHotkey(keyName, keyEvent["state"], activeKeys))
        {       
            return ; Consume the keypress, whether it was up or down.
        }
        
        local isModifier := ( InStr(keyName, "Control") || InStr(keyName, "Alt") || InStr(keyName, "Shift") || InStr(keyName, "Win") )
        
        ; --- PASSTHROUGH PATH ---
        ; If we reach here, HandleHotkey returned false, so this is NOT a macro.
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



; --- KeyRepeatHandler is simple again ---
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


; --- GetKeyNameFromCode, Startup, ExitFunc, etc. are UNCHANGED ---
GetKeyNameFromCode(code) {
    static keyMap := Map("4","a","5","b","6","c","7","d","8","e","9","f","10","g","11","h","12","i","13","j","14","k","15","l","16","m","17","n","18","o","19","p","20","q","21","r","22","s","23","t","24","u","25","v","26","w","27","x","28","y","29","z","30","1","31","2","32","3","33","4","34","5","35","6","36","7","37","8","38","9","39","0","40","Enter","41","Escape","42","Backspace","43","Tab","44","Space","45","-","46","=","47","[","48","]","49","\\","51",";","52","'","53","\`\`","54",",","55",".","56","/","57","CapsLock","58","F1","59","F2","60","F3","61","F4","62","F5","63","F6","64","F7","65","F8","66","F9","67","F10","68","F11","69","F12", "70", "PrintScreen", "76","Delete","79","Right","80","Left","81","Down","82","Up","224","LControl","225","LShift","226","LAlt","227","LWin","228","RControl","229","RShift","230","RAlt","231","RWin")
    codeStr := "" . code
    return keyMap.Has(codeStr) ? keyMap[codeStr] : ""
}

server := winsock("server", ServerCallback, "IPV4", "TCP", "Stream")
server.Bind("127.0.0.1", "8080")
server.Listen()
SetTimer(ProcessEventQueue, 15)


global mykbDir := "${safeDepsDir}\\MacroMyKB\\"
try {
    
    ; commandToRun := A_ComSpec ' /c ""' mykbDir '\\start-hidden.bat" > "' mykbDir '\\mykb_startup.log" 2>&1"'
    commandToRun := A_ComSpec ' /c ""' mykbDir '\\start-hidden.bat"'
    
    ToolTip("Running MyKB...")
    Run commandToRun, mykbDir, "Hide"
    ToolTip()
} catch {
    MsgBox "The Run command itself failed. Check AHK permissions."
}

message := ""

ExitFunc(ExitReason, ExitCode) {

    ToolTip("Trying to Exit...")
    if (ExitReason = "Reload") {
        return
    }else{
        try {
           ShowToast("Closing MacroMyKB...", , false)
           
           RunWait '"' mykbDir '\\stop-hidden.bat"', mykbDir, "Hide"
           

           ProcessClose("node.exe")
          
        

           
        } catch as e{
            
            MsgBox("Failed to Close... : " e)
        }
    }
}

^+!F16::{
    Reload()
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
    const programDataForAhk = JSON.parse(JSON.stringify(programProfiles));
    for (const progKey in programDataForAhk) {
        const escapedProgKey = progKey.replace(/["`]/g, m => '`' + m);
        const escapedActiveProfile = programDataForAhk[progKey].activeProfile.replace(/["`]/g, m => '`' + m);
        activeProfilesInitString += `    ActiveProfiles["${escapedProgKey}"] := "${escapedActiveProfile}"\n`;
        programDataForAhk[progKey].cycleHotkeyData = parseAhkHotkey(programDataForAhk[progKey].cycleHotkey);
        if (programDataForAhk[progKey].profiles) {
            for (const profKey in programDataForAhk[progKey].profiles) {
                const profile = programDataForAhk[progKey].profiles[profKey];
                for (const layerKey in profile) {
                    const layer = profile[layerKey];
                    if (typeof layer !== 'object' || layer === null) continue;
                    const newLayerWithUppercaseKeys = {};
                    for (const hotkeyKey in layer) {
                        const hotkey = layer[hotkeyKey];
                        const sanProg = sanitizeForFuncName(progKey);
                        const sanProf = sanitizeForFuncName(profKey);
                        const sanHotkey = sanitizeForFuncName(hotkeyKey);
                        if (hotkey.down && hotkey.down.trim() !== '') {
                            const funcName = `Func_${sanProg}_${sanProf}_${layerKey}_${sanHotkey}_down`;
                           const verify = ``
                            functionsString += `${funcName}() {\n${verify}\n${hotkey.down}\n}\n\n`;
                            hotkey.down = funcName;
                        }
                        if (hotkey.up && hotkey.up.trim() !== '') {
                            const funcName = `Func_${sanProg}_${sanProf}_${layerKey}_${sanHotkey}_up`;
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
    }
    Object.values(programDataForAhk).forEach(prog => delete prog.cycleHotkey);
    const programDataString = JSON.stringify(programDataForAhk);
    let contextIfChainString = ``;
    for (const progKey in programDataForAhk) {
        if (progKey !== "Global" && programDataForAhk[progKey].exeName) {
            const program = programDataForAhk[progKey];
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

HandleHotkey(keyName, state, activeKeys) {
    local currentContext := "Global"
    ${contextIfChainString}
        
    if (state = "down" && _CheckAndCycleProfile(currentContext, keyName, activeKeys))
    {
        return true
    }
    
    if (currentContext != "Global")
    {
        if (_ExecuteHotkeyForContext(currentContext, keyName, state, activeKeys))
        {
            return true
        }
    }

    if (_ExecuteHotkeyForContext("Global", keyName, state, activeKeys))
    {
        return true
    }

    return false
}

_ExecuteHotkeyForContext(contextName, keyName, state, activeKeys) {
    if (!ProgramData.Has(contextName))
    {
        return false
    }

    local program := ProgramData[contextName]
    local activeProfileName := ActiveProfiles[contextName]
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

_CheckAndCycleProfile(contextName, keyName, activeKeys) {
    _TestCycle(progName) {
        if (!ProgramData.Has(progName))
        {
             return false
        }
        local program := ProgramData[progName]
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
            local activeProfileName := ActiveProfiles[progName]
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
            ActiveProfiles[progName] := profileNames[nextIndex]
            local displayName := program.Has("displayName") ? program["displayName"] : progName
            ShowProfileToast(displayName . " -> " . profileNames[nextIndex])
        }
        return true
    }
    if (contextName != "Global" && _TestCycle(contextName))
    {
        return true
    }
    return _TestCycle("Global")
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
ShowToast(profileText, title := "Profile Changed", hasTimer := true) {
    try
    {
        local ToastGui := Gui("+AlwaysOnTop -Caption +ToolWindow", title)
        
        ToastGui.BackColor := "1E1E1E" 
        ToastGui.SetFont("s16 cF0F0F0 Bold", "Segoe UI") 
        
    
        local textCtrl := ToastGui.Add("Text", "w450 Center", profileText)
        textCtrl.Margin := "0, 2" ; 0px left/right, 20px top/bottom

        ; --- The rest of the logic remains the same ---
        ; It will now work correctly because the GUI's size is determined by our large text control.
        ToastGui.Show("NoActivate Hide")
        local w, h
        ToastGui.GetPos(,, &w, &h)
        local xPos := (A_ScreenWidth - w) / 2
        local yPos := A_ScreenHeight - h - 60

        WinSetTransparent(180, ToastGui)

        
        ToastGui.Show("NoActivate x" . xPos . " y" . yPos)
        if(hasTimer)
            SetTimer(() => ToastGui.Destroy(), -2000)
    }
}


`;
    return script;
}





function generateAhkScript() {
    // --- HELPER FUNCTION: Sanitizes a string to be a valid AHK function name part ---
    
        // --- (NEW) HELPER FUNCTION: Parses an AHK hotkey string ---
    const parseAhkHotkey = (hotkeyString) => {
        if (!hotkeyString) return null;

        let key = hotkeyString.toUpperCase();
        const result = {
            ctrl: false,
            alt: false,
            shift: false
        };

        // Check for modifier symbols and remove them
        if (key.includes('^')) {
            result.ctrl = true;
            key = key.replace(/\^/g, '');
        }
        if (key.includes('!')) {
            result.alt = true;
            key = key.replace(/!/g, '');
        }
        if (key.includes('+')) {
            result.shift = true;
            key = key.replace(/\+/g, '');
        }

        result.key = key.trim();

        

        return result;
    };
    
    
    const sanitizeForFuncName = (name) => {
        // Map special characters to descriptive text to avoid collisions.
        const specialCharsMap = {
            '`': 'Backtick',
            '-': 'Hyphen',
            '=': 'Equals',
            '[': 'LBracket',
            ']': 'RBracket',
            '\\': 'Backslash',
            ';': 'Semicolon',
            "'": 'Quote',
            ',': 'Comma',
            '.': 'Period',
            '/': 'Slash',
            ' ': 'Space' 
        };

        // If the name is a key in our special map, use the descriptive name.
        if (specialCharsMap[name]) {
            return specialCharsMap[name];
        }
        
        // For other characters (or already-safe names), use regex replacement.
        // This handles cases like 'Numpad1', 'F1', etc., safely.
        const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
        return sanitized || 'unnamed'; // Fallback for empty strings
    };

    // --- HELPER FUNCTION: Converts a JS object to a valid AHK v2 Map() string ---
    const convertJsToAhkMap = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            if (typeof obj === 'string') {
                const escapedString = obj.replace(/`/g, '``').replace(/"/g, '""');
                return `"${escapedString}"`;
            }
            return (obj ?? '""');
        }

        const entries = Object.entries(obj).map(([key, value]) => {
            const escapedKey = `"${key.replace(/`/g, '``').replace(/"/g, '""')}"`;
            const ahkValue = convertJsToAhkMap(value);
            return `${escapedKey}, ${ahkValue}`;
        });
        

        return `Map(${entries.join(', ')})`;
    };

    // --- DATA & FUNCTION GENERATION ---
    const dataForMap = JSON.parse(JSON.stringify(programProfiles)); // Deep copy
    let functionsString = `
; ===================================================================
; --- DYNAMICALLY GENERATED HOTKEY FUNCTIONS ---
; ===================================================================
`;

    // Iterate through all profiles to generate functions and update the map data
    for (const progKey in dataForMap) {
        const program = dataForMap[progKey];
         program.cycleHotkey = parseAhkHotkey(program.cycleHotkey);
        if (program.profiles) {
            for (const profKey in program.profiles) {
                const profile = program.profiles[profKey];
                const sanProf = sanitizeForFuncName(profKey);
                for (const layerKey in profile) { // e.g., hotkeys, alt_hotkeys
                    const layer = profile[layerKey];
                    if (typeof layer !== 'object' || layer === null) continue;

                    const newLayerWithUppercaseKeys = {}; // Create a temporary object
                    for (const hotkeyKey in layer) {
                        const hotkey = layer[hotkeyKey];
                        const sanProg = sanitizeForFuncName(progKey);
                        const sanProf = sanitizeForFuncName(profKey);
                        const sanHotkey = sanitizeForFuncName(hotkeyKey);

                        if (hotkey.down && hotkey.down.trim() !== '') {
                            const funcName = `Func_${sanProg}_${sanProf}_${layerKey}_${sanHotkey}_down`;
                            functionsString += `${funcName}() {\n${hotkey.down}\n}\n\n`;
                            hotkey.down = funcName;
                        }
                        if (hotkey.up && hotkey.up.trim() !== '') {
                            const funcName = `Func_${sanProg}_${sanProf}_${layerKey}_${sanHotkey}_up`;
                            functionsString += `${funcName}() {\n${hotkey.up}\n}\n\n`;
                            hotkey.up = funcName;
                        }
                        newLayerWithUppercaseKeys[hotkeyKey.toUpperCase()] = hotkey;
                    }
                    profile[layerKey] = newLayerWithUppercaseKeys;
                }
            }
        }
    }

    const allHotkeysAhkString = convertJsToAhkMap(dataForMap);
    const ahkSafeMultiKbPath = MULTIKB_EXE_PATH ? MULTIKB_EXE_PATH.replace(/\\/g, "\\\\").replace(/`/g, '``').replace(/"/g, '""') : "";
    

   

    // --- SCRIPT ASSEMBLY ---
    let script = `#Requires AutoHotkey v2.0
Persistent
#SingleInstance Force
SendMode "Input"
SetWorkingDir A_InitialWorkingDir

#Include "${safeDepsDir}\\Lib\\UISearch.ahk"




if !ProcessExist("MultiKB_For_AutoHotkey.exe") {
    try {
        Run '"${ahkSafeMultiKbPath}"'
    } catch {
        MsgBox "Could not start MultiKB_For_AutoHotkey.exe. Please ensure it is at the correct path."
    }
}


${(isUniversalMacros) ? UniversalMacros : ""}

; ===================================================================
; --- CONFIGURATION & STATE (Auto-Generated) ---
; ===================================================================
global MKB_DeviceNumber := 1
global MKB_ProcessName := "MultiKB_For_AutoHotkey.exe"
global MKB_Path := "${ahkSafeMultiKbPath}"

global AllData := ${allHotkeysAhkString}
global ActiveProfiles := Map()
global g_CurrentCatchList := Map()
`;

    for (const progName in programProfiles) {
        const escapedProgName = progName.replace(/`/g, '``').replace(/"/g, '""');
        const escapedActiveProfile = programProfiles[progName].activeProfile.replace(/`/g, '``').replace(/"/g, '""');
        script += `ActiveProfiles["${escapedProgName}"] := "${escapedActiveProfile}"\n`;
    }

    script += functionsString;

    script += `
; ===================================================================
; --- CORE DYNAMIC FUNCTIONS ---
; ===================================================================

SendData(Text) {
    socket := -1
    try {
        wsaData := Buffer(400)
        if (DllCall("ws2_32\\WSAStartup", "UShort", 0x0202, "Ptr", wsaData.Ptr) != 0) {
            throw Error("WSAStartup failed")
        }
        
        socket := DllCall("ws2_32\\socket", "Int", 2, "Int", 1, "Int", 6, "UPtr")
        if (socket = -1 or socket = 0) {
            throw Error("Socket creation failed")
        }
        
        sockaddr := Buffer(16, 0)
        NumPut("UShort", 2, sockaddr, 0)
        NumPut("UShort", DllCall("ws2_32\\htons", "UShort", 9001), sockaddr, 2)
        NumPut("UInt", DllCall("ws2_32\\inet_addr", "AStr", "127.0.0.1"), sockaddr, 4)
        
        if (DllCall("ws2_32\\connect", "UPtr", socket, "Ptr", sockaddr.Ptr, "Int", 16) != 0) {
            throw Error("Connection failed")
        }
        
        dataToSend := Text . "\`n"
        requiredSize := StrPut(dataToSend, "UTF-8")
        dataBuffer := Buffer(requiredSize)
        StrPut(dataToSend, dataBuffer, "UTF-8")
        
        if (DllCall("ws2_32\\send", "UPtr", socket, "Ptr", dataBuffer.Ptr, "Int", requiredSize - 1, "Int", 0) = -1) {
            throw Error("Send failed")
        }
    } catch as e {
        ; MsgBox("Network Error: " . e.Message)
    } finally {
        if (socket != -1 and socket != 0) {
            DllCall("ws2_32\\closesocket", "UPtr", socket)
        }
        DllCall("ws2_32\\WSACleanup")
    }
}

UpdateCatchList(vkCodeArray) {
    local vkCodesString := ""
    if (vkCodeArray.Length > 0) {
        for index, vk in vkCodeArray {
            vkCodesString .= vk . (index == vkCodeArray.Length ? "" : ",")
        }
    }
    local jsonData := '{"DeviceNumber": ' . MKB_DeviceNumber . ', "CatchVKCodes": "' . vkCodesString . '"}'
    SendData(jsonData)
}

MainContextLoop() {
    static lastContextName := ""
    static lastProfilesString := ""
    
    local currentContextName := "Global"
`;

    let contextIfChain = 'if';
    for (const progName in programProfiles) {
        const program = programProfiles[progName];
        if (progName === "Global" || !program.exeName) continue;
        
        const titlePart = program.windowTitle ? program.windowTitle.replace(/`/g, '``').replace(/"/g, '""') + " " : "";
        const exeName = program.exeName.replace(/`/g, '``').replace(/"/g, '""');
        const escapedProgName = progName.replace(/`/g, '``').replace(/"/g, '""');
        
        script += `    ${contextIfChain} (WinActive("${titlePart}ahk_exe ${exeName}")) {\n`;
        script += `        currentContextName := "${escapedProgName}"\n`;
        script += `    }\n`;
        contextIfChain = 'else if';
    }

    script += `
    local currentProfilesString := ""
    for key, value in ActiveProfiles {
        currentProfilesString .= key . ":" . value . ","
    }

    if (currentContextName == lastContextName && currentProfilesString == lastProfilesString) {
        return
    }

    g_CurrentCatchList.Clear()
    if (AllData.Has(currentContextName)) {
        local activeProfileName := ActiveProfiles[currentContextName]
        if (AllData[currentContextName].Has("profiles") && AllData[currentContextName]["profiles"].Has(activeProfileName)) {
            local currentProfile := AllData[currentContextName]["profiles"][activeProfileName]
            for layerKey, layerMap in currentProfile {
                for keyName, _ in layerMap {
                    g_CurrentCatchList[keyToVk(keyName)] := true
                }
            }
        }
    }
    
    if (currentContextName != "Global") {
        local globalProfileName := ActiveProfiles["Global"]
        if (AllData["Global"].Has("profiles") && AllData["Global"]["profiles"].Has(globalProfileName)) {
            local globalProfile := AllData["Global"]["profiles"][globalProfileName]
            for layerKey, layerMap in globalProfile {
                for keyName, _ in layerMap {
                    g_CurrentCatchList[keyToVk(keyName)] := true
                }
            }
        }
    }
`;

    for (const progName in programProfiles) {
        const program = programProfiles[progName];
        const parsedHotkey = parseAhkHotkey(program.cycleHotkey); 
        if (parsedHotkey) {
            const baseKey = parsedHotkey.key;
            const escapedKey = baseKey.replace(/`/g, '``').replace(/"/g, '""');
            script += `    g_CurrentCatchList[keyToVk("${escapedKey}")] := true\n`;
        }
    }

    script += `
    local vkCodeArray := []
    for vk, _ in g_CurrentCatchList {
        vkCodeArray.Push(vk)
    }

    UpdateCatchList(vkCodeArray)
    
    lastContextName := currentContextName
    lastProfilesString := currentProfilesString
}

ShowProfileToast(profileText) {
    ToastGui := Gui("+AlwaysOnTop -Caption +ToolWindow", "Profile Toast")
    ToastGui.BackColor := "E6E6E6"
    ToastGui.SetFont("s18 c1A1A1A", "Segoe UI")
    ToastGui.Add("Text", "w300 Center", profileText)
    ToastGui.Show("NoActivate")
    SetTimer(() => ToastGui.Destroy(), -2000)
}
`;

    script += `
; ===================================================================
; --- KEYPRESS HANDLER ---
; ===================================================================
OnMessage(1325, MsgFunc)

MsgFunc(wParam, lParam, msg, hwnd) {
    OnUniqueKeyboard(wParam, lParam & 0xFF, (lParam & 0x100) > 0, (lParam & 0x200) > 0, (lParam & 0x400) > 0, (lParam & 0x800) > 0, (lParam & 0x1000) > 0, (lParam & 0x2000) > 0, (lParam & 0x4000) > 0, (lParam & 0x8000) > 0)
}

OnUniqueKeyboard(KeyboardNumber, VKeyCode, IsDown, WasDown, IsExtended, LeftCtrl, RightCtrl, LeftAlt, RightAlt, Shift){
    AnyCtrl := LeftCtrl || RightCtrl
    AnyAlt := LeftAlt || RightAlt
    if (KeyboardNumber != MKB_DeviceNumber) {
        return
    }

    local currentContextName := "Global"
`;

    contextIfChain = 'if';
    for (const progName in programProfiles) {
        const program = programProfiles[progName];
        if (progName === "Global" || !program.exeName) continue;
        
        const titlePart = program.windowTitle ? program.windowTitle.replace(/`/g, '``').replace(/"/g, '""') + " " : "";
        const exeName = program.exeName.replace(/`/g, '``').replace(/"/g, '""');
        const escapedProgName = progName.replace(/`/g, '``').replace(/"/g, '""');
        
        script += `    ${contextIfChain} (WinActive("${titlePart}ahk_exe ${exeName}")) {\n`;
        script += `        currentContextName := "${escapedProgName}"\n`;
        script += `    }\n`;
        contextIfChain = 'else if';
    }

    script += `
    local keyString := vkCodeToKey(VKeyCode)
    if (keyString == "") {
        return
    }
    
    ProcessKeyEvent(currentContextName, VKeyCode, keyString, IsDown, AnyCtrl, AnyAlt, Shift)
}

ProcessKeyEvent(currentContextName, VKeyCode, keyString, IsDown, AnyCtrl, AnyAlt, Shift) {
    local currentProgramData := AllData[currentContextName]
    local globalProgramData := AllData["Global"]

    if (currentContextName != "Global" && currentProgramData.Has("cycleHotkey") && currentProgramData["cycleHotkey"]) {
        local cycleData := currentProgramData["cycleHotkey"]
        if (cycleData["key"] == keyString && cycleData["ctrl"] == AnyCtrl && cycleData["alt"] == AnyAlt && cycleData["shift"] == Shift && IsDown) {
            local profileNames := []
            if (currentProgramData.Has("profiles")) {
                for name, _ in currentProgramData["profiles"] {
                    profileNames.Push(name)
                }
            }
            if (profileNames.Length > 1) {
                local activeProfileName := ActiveProfiles[currentContextName]
                local currentIndex := -1
                for i, name in profileNames {
                    if (name == activeProfileName) {
                        currentIndex := i
                        break
                    }
                }
                local nextIndex := Mod(currentIndex, profileNames.Length) + 1
                ActiveProfiles[currentContextName] := profileNames[nextIndex]
                local displayName := currentProgramData.Has("displayName") ? currentProgramData["displayName"] : currentContextName
                ShowProfileToast(displayName . " -> " . profileNames[nextIndex])
            
                return
            }
        }
    }

    if (globalProgramData.Has("cycleHotkey") && globalProgramData["cycleHotkey"]) {
        local cycleData := globalProgramData["cycleHotkey"]
        if (cycleData["key"] == keyString && cycleData["ctrl"] == AnyCtrl && cycleData["alt"] == AnyAlt && cycleData["shift"] == Shift && IsDown) {
            local isOverridden := false
            if (currentContextName != "Global") {
                if (IsHotkeyDefined(currentContextName, keyString, AnyCtrl, AnyAlt, Shift)) {
                    isOverridden := true
                }
            }
            
            if (!isOverridden) {
                local profileNames := []
                if (globalProgramData.Has("profiles")) {
                    for name, _ in globalProgramData["profiles"] {
                        profileNames.Push(name)
                    }
                }
                if (profileNames.Length > 1) {
                    local activeProfileName := ActiveProfiles["Global"]
                    local currentIndex := -1
                    for i, name in profileNames {
                        if (name == activeProfileName) {
                            currentIndex := i
                            break
                        }
                    }
                    local nextIndex := Mod(currentIndex, profileNames.Length) + 1
                    ActiveProfiles["Global"] := profileNames[nextIndex]
                    ShowProfileToast("Global -> " . profileNames[nextIndex])
                
                    return
                }
            }
        }
    }

    if (currentContextName != "Global") {
        if (HandleHotkey(currentContextName, keyString, IsDown, AnyCtrl, AnyAlt, Shift)) {
            return
        }
    }
    
    if (HandleHotkey("Global", keyString, IsDown, AnyCtrl, AnyAlt, Shift)) {
        return
    }

    if (g_CurrentCatchList.Has(VKeyCode)) {
        local modifiers := ""
        if (Shift) {
            modifiers .= "+"
        }
        if (AnyCtrl) {
            modifiers .= "^"
        }
        if (AnyAlt) {
            modifiers .= "!"
        }
        local state := IsDown ? " Down" : " Up"
        local sendString := "{Blind}" . modifiers . "{" . StrLower(keyString) . state . "}"
        Send(sendString)
    }
}

IsHotkeyDefined(programName, keyString, AnyCtrl, AnyAlt, Shift) {
    local programData := AllData[programName]
    local activeProfileName := ActiveProfiles[programName]
    if (!programData.Has("profiles") || !programData["profiles"].Has(activeProfileName)) {
        return false
    }
    local profile := programData["profiles"][activeProfileName]

    local layerName := ""
    if (Shift && !AnyCtrl && !AnyAlt) {
        layerName := "shift_hotkeys"
    } else if (AnyCtrl && !Shift && !AnyAlt) {
        layerName := "ctrl_hotkeys"
    } else if (AnyAlt && !Shift && !AnyCtrl) {
        layerName := "alt_hotkeys"
    } else if (!AnyCtrl && !AnyAlt && !Shift) {
        layerName := "hotkeys"
    } else {
        return false
    }

    if (profile.Has(layerName) && profile[layerName].Has(keyString)) {
        return true
    }
    return false
}

HandleHotkey(programName, keyString, IsDown, AnyCtrl, AnyAlt, Shift) {
    local programData := AllData[programName]
    local activeProfileName := ActiveProfiles[programName]
    if (!programData.Has("profiles") || !programData["profiles"].Has(activeProfileName)) {
        return false
    }
    local profile := programData["profiles"][activeProfileName]

    local layerName := ""
    if (Shift && !AnyCtrl && !AnyAlt) {
        layerName := "shift_hotkeys"
    } else if (AnyCtrl && !Shift && !AnyAlt) {
        layerName := "ctrl_hotkeys"
    } else if (AnyAlt && !Shift && !AnyCtrl) {
        layerName := "alt_hotkeys"
    } else if (!AnyCtrl && !AnyAlt && !Shift) {
        layerName := "hotkeys"
    } else {
        return false
    }

    if (profile.Has(layerName) && profile[layerName].Has(keyString)) {
        local scriptData := profile[layerName][keyString]
        local funcName := ""

        if (IsDown && scriptData.Has("down")) {
            funcName := scriptData["down"]
        } else if (!IsDown && scriptData.Has("up")) {
            funcName := scriptData["up"]
        }

        if (funcName && Type(%funcName%) = "Func") {
            try {
                %funcName%()
            } catch as e {
                MsgBox("Hotkey execution error: " . e.Message, "Error in " . funcName, 16)
            }
        }
        return true
    }
    return false
}
`;

    script += `
; ===================================================================
; --- HELPER FUNCTIONS & STARTUP ---
; ===================================================================
keyToVk(keyName) {
    static vkMap := Map()
    if (vkMap.Count = 0) {
        vkMap := ${convertJsToAhkMap(VK_MAP)}
    }
    return vkMap.Has(StrUpper(keyName)) ? vkMap[StrUpper(keyName)] : 0
}

vkCodeToKey(vkCode) {
    static keyMap := Map()
    if (keyMap.Count = 0) {
        vkMapData := ${convertJsToAhkMap(VK_MAP)}
        for key, val in vkMapData {
            keyMap[val] := key
        }
    }
    return keyMap.Has(vkCode) ? keyMap[vkCode] : ""
}

; --- SCRIPT STARTUP & CLEANUP ---
ExitFunc(*) {
    try {
        DllCall("ws2_32\\WSACleanup")
    }
    try {
        if ProcessExist(MKB_ProcessName) {
            ProcessClose(MKB_ProcessName)
        }
    }
}

OnExit(ExitFunc)

if !ProcessExist(MKB_ProcessName) {
    try {
        Run(MKB_Path)
    } catch {
        ; Silently fail if not found, or add a MsgBox here for debugging.
    }
}

try {
    DllCall("ws2_32\\WSAStartup", "UShort", 0x0202, "Ptr", Buffer(400,0))
}

MainContextLoop()
SetTimer(MainContextLoop, 300)
`;
    
    return script;
}

const reloadCommand = "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^+%({F16})')\"";


function isProcessRunning(processName) {
  return new Promise((resolve, reject) => {
    exec("tasklist", (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.toLowerCase().includes(processName.toLowerCase()));
    });
  });
}

async function runOrReloadScript(isDriver = false) {
   const isReload = false;
  const statusMsg = document.getElementById("status-message");
  const saveBtn = document.getElementById("save-btn");

  if (saveBtn.disabled) {
    statusMsg.textContent = "Cannot run/reload due to unresolved conflicts.";
    statusMsg.style.color = "red";
    return;
  }

  // saveBtn.click() is asynchronous, but the event listener we attached is not.
  // We can call the save function directly to ensure we can await it.
  await document.getElementById("save-btn").dispatchEvent(new Event("click"));
  await new Promise((resolve) => setTimeout(resolve, 100));

  

    const ahkRunning = await isProcessRunning("AutoHotKey64.exe");
    if(!ahkRunning || !isDriver){
        try {

             statusMsg.textContent = "Starting script..."
            // --- THIS IS THE FIX ---
            // We use spawn to create a detached process.
        
            const child = spawn(AHK_EXE_PATH, [isDriver ? AHK_SERVER_SCRIPT_PATH : AHK_SCRIPT_PATH], {
                detached: true,
                stdio: "ignore", // Don't link the input/output to our app
                cwd: DEPS_DIR, // Set the correct working directory
            });

            // This tells our app not to wait for the script to finish.
            child.unref();

            // Since spawn doesn't wait, we can confirm success immediately.
            statusMsg.textContent = `Script started succesfully.`;
            statusMsg.style.color = "green";
        } catch (error) {
            statusMsg.textContent = `Error: Could not start script. Is AHK v2 installed at the correct path?`;
            statusMsg.style.color = "red";
            console.error(`Spawn Error: ${error.message}`);
        }
    }else{
        if (isDriver) {  
            statusMsg.textContent = "Reloading old script...";
            console.log(statusMsg.textContent);
            //const exeName = path.basename(AHK_EXE_PATH);

            await new Promise((resolve) => exec(reloadCommand, () => resolve()));
            await new Promise((resolve) => setTimeout(resolve, 200)); // Give it a moment to fully close
             statusMsg.textContent = "Script reloaded succesfully."
        }
  
       
    }
  isEnabled = true;
}


function setupEventListeners() {
    const profileEditorContainer = document.getElementById("profile-editor-container");
    
    //Numpad Switch

    const switchButton = document.getElementById('keyboard-view-switch');
    const qwertyView = document.getElementById('qwerty-keyboard');
    const numpadView = document.getElementById('numpad-keyboard');
    //const reorderUpBtns = document.querySelectorAll('.reorder-btn');
    
    (function reorderUp(){
        const programListNode = document.getElementById("program-list");
        programListNode.addEventListener("click", (e) => {
           
        });
    })();
    

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
            const currentProgram = programProfiles[selectedProgramName];
            if (!currentProgram) return;

            switch (e.target.id) {
                case "window-title-input":
                    if (selectedProgramName !== "Global") currentProgram.windowTitle = e.target.value;
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
        if (!selectedKeyName) return;

        const currentProgram = programProfiles[selectedProgramName];
        if (!currentProgram) return;

        // 2. The same setup logic as before, but now in one place
        const currentProfileName = document.getElementById("mapping-profile-select").value;
        const currentProfile = currentProgram.profiles[currentProfileName];


        let hotkeyMapName;
        switch (activeModifier) {
            case 'LShift':   hotkeyMapName = 'shift_hotkeys'; break;
            case 'LControl': hotkeyMapName = 'ctrl_hotkeys';  break;
            case 'LAlt':     hotkeyMapName = 'alt_hotkeys';   break;
            default:         hotkeyMapName = 'hotkeys';
        }

        if (!currentProfile[hotkeyMapName]) {
            currentProfile[hotkeyMapName] = {};
        }
        const hotkeys = currentProfile[hotkeyMapName];

        // 3. Get the values from BOTH editors
        const downScript = editorDown.getValue();
        const upScript = editorUp.getValue();

        // 4. Decide whether to update the existing hotkey or delete it
        const isHotkeyEmpty = (!downScript || downScript.trim() === "") && (!upScript || upScript.trim() === "");

        if (isHotkeyEmpty) {
            // If both scripts are empty, remove the hotkey entry entirely
            delete hotkeys[selectedKeyName];
        } else {
            // Otherwise, update or create the hotkey entry
            hotkeys[selectedKeyName] = {
                down: downScript,
                up: upScript
            };
        }

        // 5. Finally, update the UI
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
            while (programProfiles[progName]) {
                progName = `${originalName}_${counter++}`;
            }
            programProfiles[progName] = {
                displayName: progName,
                path: filePath,
                exeName: exeName,
                windowTitle: "",
                activeProfile: "Default",
                cycleHotkey: "",
                profiles: { Default: { hotkeys: {} } },
            };
            selectedProgramName = progName;
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
                    delete programProfiles[programNameToHandle];
                    selectedProgramName = "Global";
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
        
                    const newProgramProfiles = {};
                    for(const programName in programProfiles) {
                        if(programName === prevSiblingName) newProgramProfiles[programItemName] = programProfiles[programItemName];         
                        else if(programName === programItemName) newProgramProfiles[prevSiblingName] = programProfiles[prevSiblingName]          
                        else newProgramProfiles[programName] = programProfiles[programName];
                    }
                    
                    programProfiles = newProgramProfiles;
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
            if (selectedProgramName !== programNameToHandle) {
                selectedProgramName = programNameToHandle;
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
                let counter = 2;
                let originalName = progName;
                while (programProfiles[progName]) {
                    progName = `${originalName}_${counter++}`;
                }
                programProfiles[progName] = {
                    displayName: progName, path: filePath, exeName: exeName, windowTitle: "", activeProfile: "Default", cycleHotkey: "", profiles: { Default: { hotkeys: {} } },
                };
                selectedProgramName = progName;
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

    document.getElementById("run-btn").addEventListener("click", () => runOrReloadScript());
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
    document.getElementById("kb-log-btn").addEventListener("click", async (e) =>{
       
        const mmkb_dir = path.join(DEPS_DIR,"MacroMyKB")
        const logfile = path.join(mmkb_dir, "log-hidden.bat");
        
        const child = await spawn("cmd.exe", ["/c",logfile], {
            detached : true,
            cwd : mmkb_dir,
            stdio : 'ignore'
        });

        child.unref();

      
     
    });

    const programListDiv = document.getElementById("program-list");
    programListDiv.addEventListener("dblclick", (e) => {
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
            if (newName) {
                programProfiles[progName].displayName = newName;
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
        const currentProgram = programProfiles[selectedProgramName];
        if (!currentProgram) return;
        const keyDiv = target.closest(".keyboard-key");
        if (keyDiv) {

            if (keyDiv.classList.contains('disabled')) {
              return; // If the key is disabled, do nothing and exit the function.
            }
            const keyName = keyDiv.dataset.keyName;
            if (keyName === 'LShift' || keyName === 'LControl' || keyName === 'LAlt') {
                activeModifier = activeModifier === keyName ? null : keyName;
                selectedKeyName = null;
            } else {
                selectedKeyName = keyName;
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
                selectedKeyName = null;
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
                  selectedKeyName = null;
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
        const currentProgram = programProfiles[selectedProgramName];
        if (!currentProgram) return;
        switch (target.id) {
            case "mapping-profile-select":
                currentProgram.activeProfile = target.value;
                selectedKeyName = null;
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
    
     const saveSettings = async () => {
        
        await loadUniversalMacros();
        const statusMsg = document.getElementById("status-message");
        statusMsg.textContent = "Saving...";
        statusMsg.style.color = "black";
        try {
            await fs.mkdir(USER_CONFIG_DIR, { recursive: true });
            await fs.writeFile(SETTINGS_JSON_PATH, JSON.stringify(programProfiles, null, 2), "utf8");
            const generation = generateAhkScript();
            const generationDriver = generateAhkScriptDriver();
          
            await fs.writeFile(AHK_SCRIPT_PATH, generation, "utf8");
           
            await fs.writeFile(AHK_SERVER_SCRIPT_PATH, serverAHKScript, "utf8");
            
            await fs.writeFile(AHK_CONFIG_SCRIPT_PATH, generationDriver, "utf8");
            

            statusMsg.textContent = "Settings saved and AHK script generated successfully!";
            statusMsg.style.color = "green";
        } catch (err) {
            statusMsg.textContent = `Error: ${err.message}`;
            statusMsg.style.color = "red";
        }
    }
    document.getElementById("save-btn").addEventListener("click", () => saveSettings());
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



/*
const win = nw.Window.get();


win.on('close', async () => {
   
    await stopAllProcesses(); // Wait for our async function to complete
    console.log("Cleanup finished. Forcing window to close now.");
    win.close(true);

});
*/

