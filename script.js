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
  [
    { p: "`", s: "`" },
    { p: "1", s: "1" },
    { p: "2", s: "2" },
    { p: "3", s: "3" },
    { p: "4", s: "4" },
    { p: "5", s: "5" },
    { p: "6", s: "6" },
    { p: "7", s: "7" },
    { p: "8", s: "8" },
    { p: "9", s: "9" },
    { p: "0", s: "0" },
    { p: "-", s: "-" },
  ],

  [
    { p: "Q", s: "q" },
    { p: "W", s: "w" },
    { p: "E", s: "e" },
    { p: "R", s: "r" },
    { p: "T", s: "t" },
    { p: "Y", s: "y" },
    { p: "U", s: "u" },
    { p: "I", s: "i" },
    { p: "O", s: "o" },
    { p: "P", s: "p" },
    { p: "[", s: "[" },
    { p: "]", s: "]" },
  ],

  [
    { p: "Tab", s: "Tab" },
    { p: "A", s: "a" },
    { p: "S", s: "s" },
    { p: "D", s: "d" },
    { p: "F", s: "f" },
    { p: "G", s: "g" },
    { p: "H", s: "h" },
    { p: "J", s: "j" },
    { p: "K", s: "k" },
    { p: "L", s: "l" },
  ],

  [
    { p: "Space", s: "Space" },
    { p: "Z", s: "z" },
    { p: "X", s: "x" },
    { p: "C", s: "c" },
    { p: "V", s: "v" },
    { p: "B", s: "b" },
    { p: "N", s: "n" },
    { p: "M", s: "m" },
    { p: ",", s: "," },
    { p: ".", s: "." },
    { p: "/", s: "/" },
  ],
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

// ================================================================= //
//                      FUNCTION DEFINITIONS                         //
// ================================================================= //

async function initialize() {
  renderVirtualKeyboard();
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

// --- MODIFIED: Added a span for the key description ---
// --- MODIFIED: Creates a new structure for labels to sit side-by-side ---
function renderVirtualKeyboard() {
  const keyboardContainer = document.getElementById("virtual-keyboard");
  keyboardContainer.innerHTML = "";
  KEYBOARD_LAYOUT.forEach((row) => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "keyboard-row";
    row.forEach((keyData) => {
      const keyDiv = document.createElement("div");
      keyDiv.className = "keyboard-key";
      keyDiv.dataset.keyName = keyData.s;

      // NEW STRUCTURE:
      // - A span for the description at the top.
      // - A container for the two labels below it.
      keyDiv.innerHTML = `
                <span class="key-description"></span>
                <div class="key-labels-container">
                    <span class="primary-label">${keyData.p}</span>
                </div>`;

      rowDiv.appendChild(keyDiv);
    });
    keyboardContainer.appendChild(rowDiv);
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
  const modal = document.getElementById("process-modal");
  const loader = document.getElementById("modal-loader");
  const processListDiv = document.getElementById("modal-process-list");

  // --- Start: Make it look nicer ---
  // Inject the CSS styles directly into the document's head if they don't already exist.
  // This keeps everything self-contained in this function.
  if (!document.getElementById("process-list-styles")) {
    const style = document.createElement("style");
    style.id = "process-list-styles";
    style.innerHTML = `
            #modal-process-list { overflow-y: auto; border: 1px solid #ccc; border-radius: 5px; padding: 5px; }
            .process-item { display: flex; align-items: center; padding: 8px 10px; cursor: pointer; border-radius: 4px; transition: background-color 0.2s; user-select: none; }
            .process-item:hover { background-color: #e9e9e9; }
            .process-icon { width: 24px; height: 24px; margin-right: 12px; }
            .process-name { font-size: 14px; color: #333; }
        `;
    document.head.appendChild(style);
  }
  // --- End: Make it look nicer ---

  modal.style.display = "flex";
  loader.style.display = "block";
  processListDiv.innerHTML = "";

  // Your existing execPromise function.
  const execPromise = (command) =>
    new Promise((resolve, reject) => {
      exec(command, (error, stdout) => {
        if (error) return reject(error);
        resolve(stdout);
      });
    });

  try {
    // Your logic to get the process list.
    let processes = [];
    if (process.platform === "win32") {
      // We need to get the executable path to fetch the icon.
      const stdout = await execPromise(
        'wmic process where "ExecutablePath is not null" get ExecutablePath,Name /format:csv'
      );
      const lines = stdout.trim().split("\n").slice(1); // Skip header row
      const uniqueProcs = new Map();
      lines.forEach((line) => {
        const parts = line.split(",");
        const exePath = parts[1]?.trim();
        const exeName = parts[2]?.trim();
        if (exeName && exeName.endsWith(".exe") && !uniqueProcs.has(exeName)) {
          uniqueProcs.set(exeName, { name: exeName, path: exePath });
        }
      });
      processes = Array.from(uniqueProcs.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }
    // ... (your Mac/Linux fallback could be added here if needed) ...

    if (processes.length === 0) {
      processListDiv.textContent = "No running application processes found.";
      return;
    }

    // Loop through the processes and build the new UI for each one.
    for (const proc of processes) {
      const item = document.createElement("div");
      item.className = "process-item";
      item.dataset.exeName = proc.name;

      const iconImg = document.createElement("img");
      iconImg.className = "process-icon";
      // Here is where we use the tiny bridge to get the icon.
      iconImg.src =
        (await ipcRenderer.invoke("get-icon-for-path", proc.path)) || "";

      const nameSpan = document.createElement("span");
      nameSpan.className = "process-name";
      nameSpan.textContent = proc.name;

      item.appendChild(iconImg);
      item.appendChild(nameSpan);

      processListDiv.appendChild(item);
    }
  } catch (error) {
    processListDiv.textContent = `Error fetching processes: ${error.message}`;
    console.error(error);
  } finally {
    loader.style.display = "none";
  }
}

function renderProgramList() {
  const programListDiv = document.getElementById("program-list");
  programListDiv.innerHTML = "";

  for (const progName in programProfiles) {
    const program = programProfiles[progName];
    const item = document.createElement("div");
    item.className = "program-item";
    item.dataset.programName = progName;
    if (progName === selectedProgramName) {
      item.classList.add("selected");
    }

    // --- NEW STRUCTURE ---
    // 1. Create the wrapper for the display text (spans)
    const nameWrapper = document.createElement("div");
    nameWrapper.className = "program-name-wrapper";

    const displayNameSpan = document.createElement("span");
    displayNameSpan.className = "program-display-name";
    displayNameSpan.textContent = program.displayName || progName;
    nameWrapper.appendChild(displayNameSpan);

    const internalNameSpan = document.createElement("span");
    internalNameSpan.className = "program-internal-name";
    if (program.displayName && program.displayName !== progName) {
      internalNameSpan.textContent = ` [${progName}]`;
    }
    nameWrapper.appendChild(internalNameSpan);

    // 2. Create the hidden input field for editing
    const renameInput = document.createElement("input");
    renameInput.type = "text";
    renameInput.className = "program-rename-input";
    renameInput.value = program.displayName || progName;

    // Add both to the main item div
    item.appendChild(nameWrapper);
    item.appendChild(renameInput);
    // --- END OF NEW STRUCTURE ---

    if (progName !== "Global") {
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "X";
      deleteBtn.className = "delete-btn";
      deleteBtn.style.float = "right";
      item.appendChild(deleteBtn);
    }
    programListDiv.appendChild(item);
  }
}
// In script.js, REPLACE your entire renderProfileDetails function with this new one:

// REPLACE your entire renderProfileDetails function with this one:

function renderProfileDetails() {
  const programSpecificSettingsDiv = document.getElementById(
    "program-specific-settings"
  );
  const programPathDisplay = document.getElementById("program-path-display");
  const windowTitleInput = document.getElementById("window-title-input");
  const enableCycleHotkeyCheckbox = document.getElementById(
    "enable-cycle-hotkey"
  );
  const cycleHotkeyInput = document.getElementById("cycle-hotkey-input");
  const currentProgramNameSpan = document.getElementById(
    "current-program-name"
  );
  const profileSelect = document.getElementById("mapping-profile-select");
  const deleteProfileBtn = document.getElementById("delete-profile-btn");

  // --- NEW: Get the new editor elements ---
  const editorDown = document.getElementById("script-editor-down");
  const editorUp = document.getElementById("script-editor-up");
  const currentKeyNameSpanDown = document.getElementById(
    "current-key-name-down"
  );

  const currentProgram = programProfiles[selectedProgramName];
  if (!currentProgram) return;

  currentProgramNameSpan.textContent =
    currentProgram.displayName || selectedProgramName;

  if (selectedProgramName === "Global") {
    programSpecificSettingsDiv.style.visibility = "hidden";
  } else {
    programSpecificSettingsDiv.style.visibility = "visible";
    programPathDisplay.textContent = currentProgram.path || "Path not set";
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
  const hotkeys = currentProgram.profiles[currentProfileName]?.hotkeys || {};

  currentKeyNameSpanDown.textContent = selectedKeyName || "None";

  if (selectedKeyName) {
    // A key is selected, enable the editors.
    editorDown.disabled = false;
    editorUp.disabled = false;

    const hotkeyData = hotkeys[selectedKeyName];

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

function updateKeyboardVisuals() {
  const profileSelect = document.getElementById("mapping-profile-select");
  const cycleHotkeyInput = document.getElementById("cycle-hotkey-input");
  const enableCycleHotkeyCheckbox = document.getElementById(
    "enable-cycle-hotkey"
  );

  if (!profileSelect || !cycleHotkeyInput || !enableCycleHotkeyCheckbox) return;

  const isCycleEnabled = enableCycleHotkeyCheckbox.checked;
  const cycleHotkey = cycleHotkeyInput.value.trim().toLowerCase();
  const currentProfileName = profileSelect.value;
  const currentProgram = programProfiles[selectedProgramName];
  if (!currentProgram || !currentProgram.profiles[currentProfileName]) return;

  const hotkeys = currentProgram.profiles[currentProfileName].hotkeys || {};

  document.querySelectorAll(".keyboard-key").forEach((keyDiv) => {
    const keyName = keyDiv.dataset.keyName;
    const lowerCaseKeyName = keyName.toLowerCase();

    keyDiv.classList.remove("assigned", "editing", "reserved");

    const hotkeyData = hotkeys[keyName];
    const downScript = hotkeyData?.down || "";
    const upScript = hotkeyData?.up || "";

    const descriptionSpan = keyDiv.querySelector(".key-description");
    if (descriptionSpan) {
      // Show the "down" script's description by default
      descriptionSpan.textContent = extractDescriptionFromScript(downScript);
      descriptionSpan.title = descriptionSpan.textContent;
    }

    if (isCycleEnabled && cycleHotkey && lowerCaseKeyName === cycleHotkey) {
      keyDiv.classList.add("reserved");
    } else if (
      (downScript && downScript.trim() !== "") ||
      (upScript && upScript.trim() !== "")
    ) {
      keyDiv.classList.add("assigned");
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
    A: 65,
    B: 66,
    C: 67,
    D: 68,
    E: 69,
    F: 70,
    G: 71,
    H: 72,
    I: 73,
    J: 74,
    K: 75,
    L: 76,
    M: 77,
    N: 78,
    O: 79,
    P: 80,
    Q: 81,
    R: 82,
    S: 83,
    T: 84,
    U: 85,
    V: 86,
    W: 87,
    X: 88,
    Y: 89,
    Z: 90,

    0: 48,
    1: 49,
    2: 50,
    3: 51,
    4: 52,
    5: 53,
    6: 54,
    7: 55,
    8: 56,
    9: 57,

    SPACE: 32,
    ENTER: 13,
    TAB: 9,
    PAUSE: 19,
    ESCAPE: 27,

    "[": 219,
    "]": 221,
    ";": 186,
    ",": 188,
    ".": 190,
    "/": 191,
    "-": 189,
    "`": 192,
    "=": 187,
    "\\": 220,
    "'": 222,

    LShift: 160,
    RShift: 161,
    LControl: 162,
    RControl: 163,
    LAlt: 164,
    RAlt: 165,
    LWin: 91,
    RWin: 92,

    CapsLock: 20,
    ScrollLock: 145,
    NumLock: 144,
    Insert: 45,
    Delete: 46,
    Home: 36,
    End: 35,
    PgUp: 33,
    PgDn: 34,

    Up: 38,
    Down: 40,
    Left: 37,
    Right: 39,
    PrintScreen: 44,
    AppsKey: 93,
    Pause: 19,
  };

  return vkMap[upperKey] || 0;
}

// In script.js

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
    
    if (KeyboardNumber != 1)
        return

    AnyCtrl := LeftCtrl || RightCtrl
    AnyAlt := LeftAlt || RightAlt

     if (AnyCtrl || AnyAlt || Shift) {
        return
    }
    
    local foundProgramHotkey := false
`;

  // Program-specific hotkeys
  for (const progName in programProfiles) {
    const program = programProfiles[progName];
    if (progName === "Global" || !program.exeName) continue;

    const titlePart = program.windowTitle ? program.windowTitle + " " : "";
    const programContext = `if WinActive("${titlePart}ahk_exe ${program.exeName}")`;

    script += `\n    ; --- Check for ${progName.toUpperCase()} --- \n`;
    script += `    ${programContext} {\n`;

    // --- THIS IS THE RESTORED, CORRECT LOGIC ---
    const allKeysInProgram = new Set();
    for (const profName in program.profiles) {
      if (program.profiles[profName].hotkeys) {
        Object.keys(program.profiles[profName].hotkeys).forEach((k) =>
          allKeysInProgram.add(k)
        );
      }
    }
    if (program.cycleHotkey) {
      allKeysInProgram.add(program.cycleHotkey);
    }

    if (allKeysInProgram.size > 0) {
      const vkConditions = Array.from(allKeysInProgram)
        .map((key) => `VKeyCode = ${keyToVk(key)}`)
        .join(" || ");
      script += `        if (${vkConditions}) {\n`;
      script += `            foundProgramHotkey := true\n`;
      script += `        }\n`;
    }
    // --- END RESTORED LOGIC ---

    if (program.cycleHotkey) {
      const vk = keyToVk(program.cycleHotkey);
      const profiles = Object.keys(program.profiles);
      if (vk && profiles.length > 1) {
        script += `        if (VKeyCode = ${vk} && !IsDown && !AnyCtrl && !AnyAlt && !Shift) {\n`;
        script += `            local availableProfiles := ${JSON.stringify(profiles)}\n`;
        script += `            currentIndex := 0\n`;
        // --- WITH CORRECTED FOR LOOP SYNTAX ---
        script += `            for i, prof in availableProfiles {\n`;
        script += `                if (prof = Profiles["${progName}"]) {\n`;
        script += `                    currentIndex := i\n`;
        script += `                }\n`;
        script += `            }\n`;
        // ---
        script += `            nextIndex := Mod(currentIndex, availableProfiles.Length) + 1\n`;
        script += `            Profiles["${progName}"] := availableProfiles[nextIndex]\n`;
        script += `            ShowProfileToast("${program.displayName || progName} > " . Profiles["${progName}"])\n`;
        script += `            return\n`;
        script += `        }\n`;
      }
    }

    for (const profName in program.profiles) {
      const profile = program.profiles[profName];
      script += `        if (Profiles["${progName}"] = "${profName}") {\n`;
      if (profile.hotkeys) {
        for (const hotkeyName in profile.hotkeys) {
          const hotkeyData = profile.hotkeys[hotkeyName];
          const downScript = hotkeyData.down || "";
          const upScript = hotkeyData.up || "";
          const vk = keyToVk(hotkeyName);

          if (downScript.trim() !== "" || upScript.trim() !== "") {
            script += `            if (VKeyCode = ${vk}) {\n`;
            if (downScript.trim() !== "") {
              const indented = downScript
                .split("\n")
                .map((l) => "                " + l)
                .join("\n");
              script += `                if (IsDown && !AnyCtrl && !AnyAlt && !Shift) {\n${indented}\n                    return\n                }\n`;
            }
            if (upScript.trim() !== "") {
              const indented = upScript
                .split("\n")
                .map((l) => "                " + l)
                .join("\n");
              script += `                if (!IsDown && !AnyCtrl && !AnyAlt && !Shift) {\n${indented}\n                    return\n                }\n`;
            }
            script += `            }\n`;
          }
        }
      }
      script += `        }\n`;
    }

    script += `    }\n`;
  }

  // Global hotkeys
  script += `\n    if (foundProgramHotkey = false) {\n`;
  const globalProgram = programProfiles["Global"];
  if (globalProgram) {
    script += `        ; --- GLOBAL (FALLBACK) Hotkeys --- \n`;
    if (globalProgram.cycleHotkey) {
      const vk = keyToVk(globalProgram.cycleHotkey);
      if (vk) {
        script += `        if (VKeyCode = ${vk} && !IsDown && !AnyCtrl && !AnyAlt && !Shift) {\n`;
        const profiles = Object.keys(globalProgram.profiles);
        if (profiles.length > 1) {
          script += `            local availableProfiles := ${JSON.stringify(profiles)}\n`;
          script += `            currentIndex := 0\n`;
          // --- WITH CORRECTED FOR LOOP SYNTAX ---
          script += `            for i, prof in availableProfiles {\n`;
          script += `                if (prof = Profiles["Global"]) {\n`;
          script += `                    currentIndex := i\n`;
          script += `                }\n`;
          script += `            }\n`;
          // ---
          script += `            nextIndex := Mod(currentIndex, availableProfiles.Length) + 1\n`;
          script += `            Profiles["Global"] := availableProfiles[nextIndex]\n`;
          script += `            ShowProfileToast("Global: " . Profiles["Global"])\n`;
          script += `            return\n`;
        }
        script += `        }\n`;
      }
    }

    for (const profName in globalProgram.profiles) {
      const profile = globalProgram.profiles[profName];
      script += `        if (Profiles["Global"] = "${profName}") {\n`;
      if (profile.hotkeys) {
        for (const hotkeyName in profile.hotkeys) {
          const hotkeyData = profile.hotkeys[hotkeyName];
          const downScript = hotkeyData.down || "";
          const upScript = hotkeyData.up || "";
          const vk = keyToVk(hotkeyName);

          if (downScript.trim() !== "" || upScript.trim() !== "") {
            script += `            if (VKeyCode = ${vk}) {\n`;
            if (downScript.trim() !== "") {
              const indented = downScript
                .split("\n")
                .map((l) => "                " + l)
                .join("\n");
              script += `                if (IsDown && !AnyCtrl && !AnyAlt && !Shift) {\n${indented}\n                    return\n                }\n`;
            }
            if (upScript.trim() !== "") {
              const indented = upScript
                .split("\n")
                .map((l) => "                " + l)
                .join("\n");
              script += `                if (!IsDown && !AnyCtrl && !AnyAlt && !Shift) {\n${indented}\n                    return\n                }\n`;
            }
            script += `            }\n`;
          }
        }
      }
      script += `        }\n`;
    }
  }
  script += `    }\n`;
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

function setupEventListeners() {
  const profileEditorContainer = document.getElementById(
    "profile-editor-container"
  );

  // --- Combined Input Listener for BOTH editors ---
  profileEditorContainer.addEventListener("input", (e) => {
    if (
      e.target.id !== "script-editor-down" &&
      e.target.id !== "script-editor-up"
    ) {
      // Handle other inputs like window title, cycle hotkey etc.
      const currentProgram = programProfiles[selectedProgramName];
      if (!currentProgram) return;

      switch (e.target.id) {
        case "window-title-input":
          if (selectedProgramName !== "Global")
            currentProgram.windowTitle = e.target.value;
          runAllValidations();
          break;
        case "cycle-hotkey-input":
          currentProgram.cycleHotkey = e.target.value;
          runAllValidations();
          updateKeyboardVisuals();
          break;
      }
      return; // Exit after handling non-editor inputs
    }

    // --- Logic for saving to the new {down, up} structure ---
    if (selectedKeyName) {
      const currentProgram = programProfiles[selectedProgramName];
      const currentProfileName = document.getElementById(
        "mapping-profile-select"
      ).value;
      const hotkeys = currentProgram.profiles[currentProfileName].hotkeys;

      // Get existing data or create a new object
      let hotkeyData = hotkeys[selectedKeyName];
      if (typeof hotkeyData !== "object" || hotkeyData === null) {
        // Upgrade from old string format or create new
        hotkeyData = { down: hotkeyData || "", up: "" };
      }

      // Update the correct property based on which editor was changed
      if (e.target.id === "script-editor-down") {
        hotkeyData.down = e.target.value;
      } else if (e.target.id === "script-editor-up") {
        hotkeyData.up = e.target.value;
      }

      // If both scripts are now empty, delete the hotkey entirely.
      if (
        (!hotkeyData.down || hotkeyData.down.trim() === "") &&
        (!hotkeyData.up || hotkeyData.up.trim() === "")
      ) {
        delete hotkeys[selectedKeyName];
      } else {
        hotkeys[selectedKeyName] = hotkeyData;
      }

      updateKeyboardVisuals();
    }
  });

  // The rest of the setupEventListeners function is your working code...
  // THIS IS YOUR NEW CODE
  document
    .getElementById("add-program-btn")
    .addEventListener("click", async () => {
      // 1. We ask the main process to show the dialog and wait for the path.
      // The 'async' on the function is important so we can use 'await'.
      const filePath = await ipcRenderer.invoke("show-open-dialog", {
        title: "Select Program Executable",
        buttonLabel: "Add Program",
      });

      // 2. We check if filePath is not null (meaning the user didn't cancel).
      if (filePath) {
        // From here on, the logic is IDENTICAL to your old code,
        // because we now have the 'filePath' string we needed.
        const exeName = path.basename(filePath);
        let progName = exeName.replace(".exe", "").replace(/[\s()]/g, "");
        if (!progName) {
          progName = "Program";
        }
        let counter = 2;
        let originalName = progName;
        while (programProfiles[progName]) {
          progName = `${originalName}_${counter++}`;
        }
        programProfiles[progName] = {
          displayName: progName,
          path: filePath, // Use the path we got from the main process
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
    // The new, correct code
    if (e.target.classList.contains("delete-btn")) {
      e.stopPropagation();

      // Use an IIFE for async/await
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
  document
    .getElementById("add-process-btn")
    .addEventListener("click", showProcessList);
  const modal = document.getElementById("process-modal");
  const modalProcessList = document.getElementById("modal-process-list");
  document.getElementById("modal-close-btn").addEventListener("click", () => {
    modal.style.display = "none";
  });
  modalProcessList.addEventListener("click", async (e) => {
    const processItem = e.target.closest(".process-item");

    // If we didn't click inside an item, do nothing.
    if (!processItem) return;

    // Now, get the exeName from the dataset of the item we found.
    const exeName = processItem.dataset.exeName;
    const loader = document.getElementById("modal-loader");
    loader.textContent = `Resolving path for ${exeName}...`;
    loader.style.display = "block";

    try {
      let filePath = "Path not found";
      if (process.platform === "win32") {
        const stdout = await new Promise((resolve, reject) => {
          exec(
            `wmic process where "name='${exeName}'" get ExecutablePath`,
            (err, stdout) => {
              if (err) return reject(err);
              resolve(stdout);
            }
          );
        });
        const pathLine = stdout.split("\n")[1];
        if (pathLine) {
          filePath = pathLine.trim();
        }
      }

      if (filePath !== "Path not found") {
        let progName = exeName.replace(".exe", "").replace(/[\s()]/g, "");
        if (!progName) {
          progName = "Program";
        }
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
        modal.style.display = "none";
      } else {
        alert(
          `Could not resolve the full path for ${exeName}. You may need to add it manually.`
        );
      }
    } catch (error) {
      alert(`Error getting path: ${error.message}`);
    } finally {
      loader.style.display = "none";
      loader.textContent = "Loading...";
    }
  });
  document
    .getElementById("run-btn")
    .addEventListener("click", () => runOrReloadScript(false));
  document
    .getElementById("reload-btn")
    .addEventListener("click", () => runOrReloadScript(true));

  document
    .getElementById("stop-all-btn")
    .addEventListener("click", stopAllProcesses);

  // Inside setupEventListeners()

  const programListDiv = document.getElementById("program-list");

  programListDiv.addEventListener("dblclick", (e) => {
    // Find the parent item and the elements within it
    const programItem = e.target.closest(".program-item");
    if (!programItem) return;

    const progName = programItem.dataset.programName;
    if (progName === "Global") return;

    const nameWrapper = programItem.querySelector(".program-name-wrapper");
    const renameInput = programItem.querySelector(".program-rename-input");

    // If we're already editing, do nothing.
    if (renameInput.classList.contains("editing")) return;

    // --- Start the Edit ---
    // Hide the display text and show/activate the input
    nameWrapper.style.display = "none";
    renameInput.classList.add("editing");

    // Focus and select the text
    setTimeout(() => {
      renameInput.focus();
      renameInput.select();
    }, 16);

    // --- Define the cleanup function ---
    const finishEdit = () => {
      const newName = renameInput.value.trim();

      if (newName) {
        // Save the data
        programProfiles[progName].displayName = newName;

        // Update the display spans with the new text
        const displayNameSpan = nameWrapper.querySelector(
          ".program-display-name"
        );
        const internalNameSpan = nameWrapper.querySelector(
          ".program-internal-name"
        );
        displayNameSpan.textContent = newName;
        if (newName !== progName) {
          internalNameSpan.textContent = ` [${progName}]`;
        } else {
          internalNameSpan.textContent = "";
        }
      }

      // Hide the input and show the display text again
      renameInput.classList.remove("editing");
      nameWrapper.style.display = "";
    };

    // --- Attach one-time listeners to finish the edit ---
    renameInput.addEventListener("blur", finishEdit, { once: true });
    renameInput.addEventListener(
      "keydown",
      (keyEvent) => {
        if (keyEvent.key === "Enter" || keyEvent.key === "Escape") {
          // Trigger the blur event to run the finishEdit logic
          renameInput.blur();
        }
      },
      { once: true }
    );
  });
  // --- Handle finishing the edit ---
  programListDiv.addEventListener("focusout", (e) => {
    // This event fires when an element inside the list loses focus
    if (e.target.classList.contains("program-name-input")) {
      const input = e.target;
      const progName = input.dataset.progName;

      // Save the new name and make it read-only again
      const newName = input.value.trim();
      if (newName) {
        programProfiles[progName].displayName = newName;
      } else {
        // If the user deleted the name, revert to the original
        input.value = programProfiles[progName].displayName || progName;
      }

      input.readOnly = true;
      input.classList.remove("editable");

      // Update the visibility of the internal name span
      const internalNameSpan = input.nextElementSibling;
      if (
        internalNameSpan &&
        internalNameSpan.classList.contains("program-internal-name")
      ) {
        internalNameSpan.style.display =
          input.value === progName ? "none" : "inline";
      }
    }
  });

  // --- Handle Enter/Escape keys ---
  programListDiv.addEventListener("keydown", (e) => {
    if (e.target.classList.contains("program-name-input")) {
      if (e.key === "Enter" || e.key === "Escape") {
        // Simply remove focus, which will trigger the 'focusout' event to save/revert.
        e.target.blur();
      }
    }
  });

  profileEditorContainer.addEventListener("click", (e) => {
    const target = e.target;
    const currentProgram = programProfiles[selectedProgramName];
    if (!currentProgram) return;
    const keyDiv = target.closest(".keyboard-key");
    if (keyDiv) {
      selectedKeyName = keyDiv.dataset.keyName;
      renderProfileDetails();
      updateKeyboardVisuals();
      const editorDown = document.getElementById("script-editor-down");
      editorDown.focus();
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
      // The new, correct code
      // The new, correct code
      case "delete-profile-btn":
        // Use an IIFE to allow async/await inside the switch case
        (async () => {
          const profileSelect = document.getElementById(
            "mapping-profile-select"
          );
          const profileToDelete = profileSelect.value;

          if (profileToDelete !== "Default") {
            // Call our new, non-blocking dialog
            const confirmed = await ipcRenderer.invoke("show-confirm-dialog", {
              title: "Delete Profile",
              message: `Are you sure you want to delete the profile "${profileToDelete}"?`,
              detail: "This action cannot be undone.",
            });

            // If the user clicked "Yes" (confirmed is true)
            if (confirmed) {
              delete currentProgram.profiles[profileToDelete];
              currentProgram.activeProfile = "Default";
              selectedKeyName = null;
              renderUI();
            }
          }
        })();
        break;
      // This is the new, correct code that uses our IPC handler

      case "change-path-btn":
        // Use an IIFE (Immediately Invoked Function Expression) to use async/await here
        (async () => {
          // 1. Ask the main process to show the dialog and wait for the result.
          const filePath = await ipcRenderer.invoke("show-open-dialog", {
            title: "Change Program Path",
            buttonLabel: "Select New Path",
          });

          // 2. If the user selected a file (didn't cancel)
          if (filePath) {
            // This is your existing logic, which is already correct.
            if (currentProgram) {
              currentProgram.path = filePath;
              currentProgram.exeName = path.basename(filePath);
              renderProfileDetails();
              runAllValidations(); // It's good practice to re-run validations after changing a path
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
        document.getElementById("cycle-hotkey-input").disabled =
          !target.checked;
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
    if (
      e.target.id === "script-editor-down" ||
      e.target.id === "script-editor-up"
    ) {
      const editor = e.target;
      if (e.key === "Tab") {
        e.preventDefault();
        const start = editor.selectionStart;
        const indentation = "    ";
        editor.value =
          editor.value.substring(0, start) +
          indentation +
          editor.value.substring(start);
        editor.selectionStart = editor.selectionEnd =
          start + indentation.length;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const start = editor.selectionStart;
        const textToCursor = editor.value.substring(0, start);
        const currentLine = textToCursor.substring(
          textToCursor.lastIndexOf("\n") + 1
        );
        const indentation = currentLine.match(/^\s*/)?.[0] || "";
        const newValue = "\n" + indentation;
        editor.value =
          editor.value.substring(0, start) +
          newValue +
          editor.value.substring(start);
        editor.selectionStart = editor.selectionEnd = start + newValue.length;
      }
    }
  });
  document.getElementById("save-btn").addEventListener("click", async () => {
    const statusMsg = document.getElementById("status-message");
    statusMsg.textContent = "Saving...";
    statusMsg.style.color = "black";
    try {
      await fs.mkdir(DEPS_DIR, { recursive: true });
      await fs.writeFile(
        SETTINGS_JSON_PATH,
        JSON.stringify(programProfiles, null, 2),
        "utf8"
      );
      await fs.writeFile(AHK_SCRIPT_PATH, generateAhkScript(), "utf8");
      statusMsg.textContent =
        "Settings saved and AHK script generated successfully!";
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
