const { ipcRenderer } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const { exec, spawn } = require("child_process");
const { globalShortcut } = require("electron");

//import GlobalShortcutManager from './GlobalShortcutManager.js';

const appInfo = ipcRenderer.sendSync("get-app-info");

// --- Constants & State ---
const DEPS_DIR = appInfo.isPackaged
  ? path.join(process.resourcesPath, "deps")
  : path.join(appInfo.appPath, "deps");
//const CONFIG_DIR = path.join(process.cwd(), './config');
const USER_DIR = path.join(appInfo.userDataPath, "config");
const SETTINGS_JSON_PATH = path.join(USER_DIR, "user-settings.json");
const AHK_SCRIPT_PATH = path.join(USER_DIR, "user-settings.ahk");
// Add this line around line 13 in your script.js

const AHK_EXE_PATH = appInfo.ahkPath;
const MULTIKB_EXE_PATH = path.join(DEPS_DIR, "MKB\\MultiKB_For_AutoHotkey.exe");

const KEYBOARD_LAYOUT = [
    [{ p: "Esc", s: "Escape", disabled: true }, { p: "F1", s: "F1" }, { p: "F2", s: "F2" }, { p: "F3", s: "F3" }, { p: "F4", s: "F4" }, { p: "F5", s: "F5" }, { p: "F6", s: "F6" }, { p: "F7", s: "F7" }, { p: "F8", s: "F8" }, { p: "F9", s: "F9" }, { p: "F10", s: "F10" }, { p: "F11", s: "F11" }, { p: "F12", s: "F12" }],
    
    [{ p: "`", s: "`" }, { p: "1", s: "1" }, { p: "2", s: "2" }, { p: "3", s: "3" }, { p: "4", s: "4" }, { p: "5", s: "5" }, { p: "6", s: "6" }, { p: "7", s: "7" }, { p: "8", s: "8" }, { p: "9", s: "9" }, { p: "0", s: "0" }, { p: "-", s: "-" }, { p: "=", s: "=" }],
    
    [{ p: "Tab", s: "Tab" }, { p: "Q", s: "q" }, { p: "W", s: "w" }, { p: "E", s: "e" }, { p: "R", s: "r" }, { p: "T", s: "t" }, { p: "Y", s: "y" }, { p: "U", s: "u" }, { p: "I", s: "i" }, { p: "O", s: "o" }, { p: "P", s: "p" }, { p: "[", s: "[" }, { p: "]", s: "]" }],
    
    [{ p: "Caps", s: "CapsLock", disabled: true }, { p: "A", s: "a" }, { p: "S", s: "s" }, { p: "D", s: "d" }, { p: "F", s: "f" }, { p: "G", s: "g" }, { p: "H", s: "h" }, { p: "J", s: "j" }, { p: "K", s: "k" }, { p: "L", s: "l" }, { p: ";", s: ";" }, { p: "'", s: "'" }, { p: "Enter", s: "Enter" }],
    
    [{ p: "Shift", s: "LShift" }, { p: "Z", s: "z" }, { p: "X", s: "x" }, { p: "C", s: "c" }, { p: "V", s: "v" }, { p: "B", s: "b" }, { p: "N", s: "n" }, { p: "M", s: "m" }, { p: ",", s: "," }, { p: ".", s: "." }, { p: "/", s: "/" }, { p: "Shift", s: "RShift", disabled: true }],
    
    [{ p: "Ctrl", s: "LControl" }, { p: "Alt", s: "LAlt" }, { p: "Space", s: "Space" }, { p: "Alt", s: "RAlt", disabled: true }, { p: "Ctrl", s: "RControl", disabled: true }]
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


const defaultData = {
  Global: {
    displayName: "Global",
    activeProfile: "Default",
    cycleHotkey: "",
    profiles: {
      Default: {
        hotkeys: { F13: 'MsgBox("This is the default Global profile.")' },
      },
    },
  },
};
let programProfiles = {};
let selectedProgramName = "Global";
let selectedKeyName = null;
let isEnabled = false;
let activeModifier = null;

// ================================================================= //
//                      FUNCTION DEFINITIONS                         //
// ================================================================= //

async function initialize() {
  renderQwertyKeyboard();
  renderNumpadKeyboard();

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
    const editorDown = document.getElementById("script-editor-down");
    const editorUp = document.getElementById("script-editor-up");
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

    if (selectedKeyName) {
        editorDown.disabled = false;
        editorUp.disabled = false;

        const hotkeyData = hotkeyMap[selectedKeyName]; // Read from the correct map

        if (hotkeyData) {
            editorDown.value = hotkeyData.down || "";
            editorUp.value = hotkeyData.up || "";
        } else {
            editorDown.value = "";
            editorUp.value = "";
        }
    } else {
        editorDown.disabled = true;
        editorUp.disabled = true;
        editorDown.value = "";
        editorUp.value = "";
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
  const vkMap = {
        // --- Main Keyboard ---
        // Function Row
        'ESCAPE': 27, 'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116, 'F6': 117, 'F7': 118, 'F8': 119, 'F9': 120, 'F10': 121, 'F11': 122, 'F12': 123,

        // Number Row
        '`': 192, '1': 49, '2': 50, '3': 51, '4': 52, '5': 53, '6': 54, '7': 55, '8': 56, '9': 57, '0': 48, '-': 189, '=': 187,

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


  return vkMap[upperKey] || 0;
}

// In script.js

// REPLACE this entire function in script.js
// REPLACE this entire function in script.js
// REPLACE this entire function in script.js
function generateAhkScript() {
    const ahkSafeMultiKbPath = MULTIKB_EXE_PATH.replace(/\\/g, "\\\\");
    let script = `#Requires AutoHotkey v2.0
Persistent
#SingleInstance
SendMode "Input"
SetWorkingDir A_InitialWorkingDir

; This file is auto-generated. Do not edit directly.

#Include ${DEPS_DIR}\\Lib\\UISearch.ahk

; Check if MultiKB is running to prevent multiple instances
if !ProcessExist("MultiKB_For_AutoHotkey.exe") {
    try {
        Run "${ahkSafeMultiKbPath}"
    } catch {
        MsgBox "Could not start MultiKB_For_AutoHotkey.exe. Please ensure it is at the correct path."
    }
}

global Profiles := Map()
`;
    for (const progName in programProfiles) {
        script += `Profiles["${progName}"] := "${programProfiles[progName].activeProfile}"\n`;
    }
    script += `
OnMessage(1325, MsgFunc)

MsgFunc(wParam, lParam, msg, hwnd) {
  OnUniqueKeyboard(wParam, lParam & 0xFF, (lParam & 0x100) > 0, (lParam & 0x200) > 0, (lParam & 0x400) > 0, (lParam & 0x800) > 0, (lParam & 0x1000) > 0, (lParam & 0x2000) > 0, (lParam & 0x4000) > 0, (lParam & 0x8000) > 0)  	
}

ShowProfileToast(profileText) {
    ToastGui := Gui("+AlwaysOnTop -Caption +ToolWindow", "Profile Toast")
    ToastGui.BackColor := "E6E6E6"
    ToastGui.SetFont("s18 c1A1A1A", "Segoe UI")
    ToastGui.Add("Text", "w300 Center", profileText)
    ToastGui.Show("NoActivate")
    SetTimer(() => ToastGui.Destroy(), -2000)
}

OnUniqueKeyboard(KeyboardNumber, VKeyCode, IsDown, WasDown, IsExtended, LeftCtrl, RightCtrl, LeftAlt, RightAlt, Shift) {
    global Profiles
    
    if (KeyboardNumber != 1) {
        return
    }

    AnyCtrl := LeftCtrl || RightCtrl
    AnyAlt := LeftAlt || RightAlt
`;
    
    const generateLayerCode = (hotkeyMap) => {
        let layerScript = '';
        if (!hotkeyMap) return '';
        for (const hotkeyName in hotkeyMap) {
            const hotkeyData = hotkeyMap[hotkeyName];
            const vk = keyToVk(hotkeyName);
            if (!vk || (!hotkeyData.down && !hotkeyData.up)) continue;
            layerScript += `            if (VKeyCode == ${vk}) {\n`;
            if (hotkeyData.down && hotkeyData.down.trim()) {
                const indented = hotkeyData.down.split('\n').map(l => '                ' + l).join('\n');
                layerScript += `                if (IsDown) {\n${indented}\n                    return\n                }\n`;
            }
            if (hotkeyData.up && hotkeyData.up.trim()) {
                const indented = hotkeyData.up.split('\n').map(l => '                ' + l).join('\n');
                layerScript += `                if (!IsDown) {\n${indented}\n                    return\n                }\n`;
            }
            layerScript += `            }\n`;
        }
        return layerScript;
    };

    script += `
    ; --- Base Layer (No Modifiers) ---
    if (!AnyCtrl && !AnyAlt && !Shift) {
        local foundProgramHotkey := false
`;
    for (const progName in programProfiles) {
        const program = programProfiles[progName];
        if (progName === "Global" || !program.exeName) continue;
        const titlePart = program.windowTitle ? program.windowTitle + " " : "";
        script += `\n        ; --- Check for ${progName.toUpperCase()} --- \n`;
        script += `        if (WinActive("${titlePart}ahk_exe ${program.exeName}")) {\n`;
        const allKeysInProgram = new Set();
        for (const profName in program.profiles) {
            if (program.profiles[profName].hotkeys) {
                Object.keys(program.profiles[profName].hotkeys).forEach((k) => allKeysInProgram.add(k));
            }
        }
        if (program.cycleHotkey) {
            allKeysInProgram.add(program.cycleHotkey);
        }
        if (allKeysInProgram.size > 0) {
            const vkConditions = Array.from(allKeysInProgram).map((key) => `VKeyCode == ${keyToVk(key)}`).join(" || ");
            script += `            if (${vkConditions}) {\n                foundProgramHotkey := true\n            }\n`;
        }
        if (program.cycleHotkey) {
            const vk = keyToVk(program.cycleHotkey);
            const profiles = Object.keys(program.profiles);
            if (vk && profiles.length > 1) {
                script += `            if (VKeyCode == ${vk} && !IsDown) {\n`;
                script += `                local availableProfiles := ${JSON.stringify(profiles)}\n`;
                script += `                currentIndex := 0\n`;
                script += `                for i, prof in availableProfiles {\n`;
                script += `                    if (prof == Profiles["${progName}"]) {\n                        currentIndex := i\n                    }\n`;
                script += `                }\n`;
                script += `                nextIndex := Mod(currentIndex, availableProfiles.Length) + 1\n`;
                script += `                Profiles["${progName}"] := availableProfiles[nextIndex]\n`;
                script += `                ShowProfileToast("${program.displayName || progName} > " . Profiles["${progName}"])\n`;
                script += `                return\n`;
                script += `            }\n`;
            }
        }
        for (const profName in program.profiles) {
            const profile = program.profiles[profName];
            script += `            if (Profiles["${progName}"] == "${profName}") {\n`;
            script += generateLayerCode(profile.hotkeys);
            script += `            }\n`;
        }
        script += `        }\n`;
    }
    script += `\n        if (!foundProgramHotkey) {\n`;
    const globalProgram = programProfiles["Global"];
    if (globalProgram) {
        script += `            ; --- GLOBAL (FALLBACK) Hotkeys --- \n`;
        if (globalProgram.cycleHotkey) {
            const vk = keyToVk(globalProgram.cycleHotkey);
            if (vk) {
                script += `            if (VKeyCode == ${vk} && !IsDown) {\n`;
                const profiles = Object.keys(globalProgram.profiles);
                if (profiles.length > 1) {
                    script += `                local availableProfiles := ${JSON.stringify(profiles)}\n`;
                    script += `                currentIndex := 0\n`;
                    script += `                for i, prof in availableProfiles {\n`;
                    script += `                    if (prof == Profiles["Global"]) {\n                        currentIndex := i\n                    }\n`;
                    script += `                }\n`;
                    script += `                nextIndex := Mod(currentIndex, availableProfiles.Length) + 1\n`;
                    script += `                Profiles["Global"] := availableProfiles[nextIndex]\n`;
                    script += `                ShowProfileToast("Global: " . Profiles["Global"])\n`;
                    script += `                return\n`;
                }
                script += `            }\n`;
            }
        }
        for (const profName in globalProgram.profiles) {
            const profile = globalProgram.profiles[profName];
            script += `            if (Profiles["Global"] == "${profName}") {\n`;
            script += generateLayerCode(profile.hotkeys);
            script += `            }\n`;
        }
    }
    script += `        }\n    }\n`;

    const modifiers = [
        { name: 'Shift', mapName: 'shift_hotkeys', condition: 'Shift && !AnyCtrl && !AnyAlt' },
        { name: 'Ctrl',  mapName: 'ctrl_hotkeys',  condition: 'AnyCtrl && !Shift && !AnyAlt' },
        { name: 'Alt',   mapName: 'alt_hotkeys',   condition: 'AnyAlt && !Shift && !AnyCtrl' }
    ];
    for (const modifier of modifiers) {
        script += `\n    ; --- ${modifier.name} Layer ---\n    if (${modifier.condition}) {\n`;
        for (const progName in programProfiles) {
             const program = programProfiles[progName];
             if (progName === 'Global' || !program.exeName) continue;
             const titlePart = program.windowTitle ? program.windowTitle + " " : "";
             script += `        if (WinActive("${titlePart}ahk_exe ${program.exeName}")) {\n`;
             for (const profName in program.profiles) {
                const profile = program.profiles[profName];
                script += `            if (Profiles["${progName}"] == "${profName}") {\n`;
                script += generateLayerCode(profile[modifier.mapName]);
                script += `            }\n`;
             }
             script += `            return ; IMPORTANT: Prevent fallback to global if an app-specific key is found on this layer\n`;
             script += `        }\n`;
        }
        const global = programProfiles['Global'];
        if(global) {
            script += `        ; --- GLOBAL (FALLBACK) Hotkeys --- \n`;
            for (const profName in global.profiles) {
                const profile = global.profiles[profName];
                script += `        if (Profiles["Global"] == "${profName}") {\n`;
                script += generateLayerCode(profile[modifier.mapName]);
                script += `        }\n`;
            }
        }
        script += `    }\n`;
    }

    script += `}\n`;
    script += `
KillProcessOnExit(ExitReason, ExitCode) {
    try ProcessClose("MultiKB_For_AutoHotkey.exe")
}
OnExit(KillProcessOnExit)
`;
    return script;
}

// REPLACE your entire runOrReloadScript function with this one:

async function runOrReloadScript(isReload = false) {
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

  if (isReload) {
    statusMsg.textContent = "Reloading: Stopping old script...";
    const exeName = path.basename(AHK_EXE_PATH);
    const killCommand = `taskkill /IM "${exeName}" /F`;
    await new Promise((resolve) => exec(killCommand, () => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 200)); // Give it a moment to fully close
  }

  statusMsg.textContent = "Starting script...";

  try {
    // --- THIS IS THE FIX ---
    // We use spawn to create a detached process.
    const child = spawn(AHK_EXE_PATH, [AHK_SCRIPT_PATH], {
      detached: true,
      stdio: "ignore", // Don't link the input/output to our app
      cwd: DEPS_DIR, // Set the correct working directory
    });

    // This tells our app not to wait for the script to finish.
    child.unref();

    // Since spawn doesn't wait, we can confirm success immediately.
    statusMsg.textContent = `Script ${isReload ? "reloaded" : "started"} successfully!`;
    statusMsg.style.color = "green";
  } catch (error) {
    statusMsg.textContent = `Error: Could not start script. Is AHK v2 installed at the correct path?`;
    statusMsg.style.color = "red";
    console.error(`Spawn Error: ${error.message}`);
  }
  isEnabled = true;
}

// In script.js, REPLACE your entire setupEventListeners function with this new one:

// REPLACE your entire setupEventListeners function with this one:

// REPLACE this entire function in script.js
function setupEventListeners() {
    const profileEditorContainer = document.getElementById("profile-editor-container");
    
    //Numpad Switch

    const switchButton = document.getElementById('keyboard-view-switch');
    const qwertyView = document.getElementById('qwerty-keyboard');
    const numpadView = document.getElementById('numpad-keyboard');

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
            }
            return;
        }

        if (selectedKeyName) {
            const currentProgram = programProfiles[selectedProgramName];
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

            let hotkeyData = hotkeys[selectedKeyName];
            if (typeof hotkeyData !== "object" || hotkeyData === null) {
                hotkeyData = { down: hotkeyData || "", up: "" };
            }
            if (e.target.id === "script-editor-down") {
                hotkeyData.down = e.target.value;
            } else if (e.target.id === "script-editor-up") {
                hotkeyData.up = e.target.value;
            }
            if ((!hotkeyData.down || hotkeyData.down.trim() === "") && (!hotkeyData.up || hotkeyData.up.trim() === "")) {
                delete hotkeys[selectedKeyName];
            } else {
                hotkeys[selectedKeyName] = hotkeyData;
            }
            updateKeyboardVisuals();
        }
    });

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
        if (e.target.classList.contains("delete-btn")) {
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
        } else {
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

    document.getElementById("run-btn").addEventListener("click", () => runOrReloadScript(false));
    //document.getElementById("reload-btn").addEventListener("click", () => runOrReloadScript(true));
    document.getElementById("stop-all-btn").addEventListener("click", stopAllProcesses);

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

    profileEditorContainer.addEventListener("click", (e) => {
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
            const editorDown = document.getElementById("script-editor-down");
            if (!editorDown.disabled) editorDown.focus();
            return;
        }
        switch (target.id) {
            case "add-profile-btn":
                const newProfileName = prompt("Enter new profile name:", "");
                if (newProfileName) {
                    if (!currentProgram.profiles[newProfileName]) {
                        currentProgram.profiles[newProfileName] = { hotkeys: {} };
                        currentProgram.activeProfile = newProfileName;
                        selectedKeyName = null;
                        renderUI();
                    } else {
                        alert(`Profile "${newProfileName}" already exists.`);
                    }
                }
                break;
            case "delete-profile-btn":
                (async () => {
                    const profileSelect = document.getElementById("mapping-profile-select");
                    const profileToDelete = profileSelect.value;
                    if (profileToDelete !== "Default") {
                        const confirmed = await ipcRenderer.invoke("show-confirm-dialog", {
                            title: "Delete Profile", message: `Are you sure you want to delete the profile "${profileToDelete}"?`, detail: "This action cannot be undone.",
                        });
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
                        title: "Change Program Path", buttonLabel: "Select New Path",
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

    profileEditorContainer.addEventListener("keydown", (e) => {
        if (e.target.id === "script-editor-down" || e.target.id === "script-editor-up") {
            const editor = e.target;
            if (e.key === "Tab") {
                e.preventDefault();
                const start = editor.selectionStart;
                const indentation = "    ";
                editor.value = editor.value.substring(0, start) + indentation + editor.value.substring(start);
                editor.selectionStart = editor.selectionEnd = start + indentation.length;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                const start = editor.selectionStart;
                const textToCursor = editor.value.substring(0, start);
                const currentLine = textToCursor.substring(textToCursor.lastIndexOf("\n") + 1);
                const indentation = currentLine.match(/^\s*/)?.[0] || "";
                const newValue = "\n" + indentation;
                editor.value = editor.value.substring(0, start) + newValue + editor.value.substring(start);
                editor.selectionStart = editor.selectionEnd = start + newValue.length;
            }
        }
    });
    
    document.getElementById("save-btn").addEventListener("click", async () => {
        const statusMsg = document.getElementById("status-message");
        statusMsg.textContent = "Saving...";
        statusMsg.style.color = "black";
        try {
            await fs.mkdir(USER_DIR, { recursive: true });
            await fs.writeFile(SETTINGS_JSON_PATH, JSON.stringify(programProfiles, null, 2), "utf8");
            await fs.writeFile(AHK_SCRIPT_PATH, generateAhkScript(), "utf8");
            statusMsg.textContent = "Settings saved and AHK script generated successfully!";
            statusMsg.style.color = "green";
        } catch (err) {
            statusMsg.textContent = `Error: ${err.message}`;
            statusMsg.style.color = "red";
        }
    });
}
// ================================================================= //
//                      APPLICATION STARTUP                          //
// ================================================================= //

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  initialize();



  ipcRenderer.on("global-shortcut-triggered", (event, action) => {
    console.log("Shortcut message received:", action); // For debugging
    if (action === "toggle-run-stop") {
      if (!isEnabled) {
        document.getElementById("run-btn").click();
        // The old toast opened a new window, which is more complex in Electron.
        // For now, let's just log it or update the status bar.
        ipcRenderer.send("show-toast", "Enabled", "lightgreen", 500);
      } else {
        document.getElementById("stop-all-btn").click();
        ipcRenderer.send("show-toast", "Disabled", "lightcoral", 500);
      }
    }
  });
});



ipcRenderer.on("clean-close", async () => {
  await stopAllProcesses();
});



/*
const win = nw.Window.get();


win.on('close', async () => {
   
    await stopAllProcesses(); // Wait for our async function to complete
    console.log("Cleanup finished. Forcing window to close now.");
    win.close(true);

});
*/
