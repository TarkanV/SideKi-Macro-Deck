"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const yamljs_1 = __importDefault(require("yamljs"));
const FS = __importStar(require("fs"));
const Util = __importStar(require("util"));
const device_1 = require("./device");
const macroMyKBD_1 = require("./macroMyKBD");
const ahkClient = require('./ahk-client');
const hidHandler = require('hid-handler');

// This script is designed to be "dumb". It runs once and exits on any error.
// The start.bat file is responsible for restarting it.

async function main() {
    console.log("Attempting to connect to keyboard...");
    const conf = await Util.promisify(FS.readFile)('./actions.yml').then(d => yamljs_1.default.parse(d.toString()));
    
    // Create a single instance of our keyboard logic for this run.
    const mmkbd = new macroMyKBD_1.MacroMyKBD();

    for (let d of conf.devices) {
        mmkbd.addDevice(new device_1.Device(d));
    }

    // Set up the single key listener. This will not leak because the process dies on error.
    hidHandler.on('key', (e) => {
        if (mmkbd) {
            mmkbd.handleKey(e);
        }
    });
    
    // We are using our patched hid-handler. If the device is not found, this will
    // throw an error, which will be caught by the .catch() below and exit the process.
    await mmkbd.start();
    // --- Startup and Global Error Handlers ---
    ahkClient.connect();
    console.log(">>> SUCCESS: MyKBD listener connected and running.");
}



main().catch(err => {
    // This catches errors during the startup process (e.g., keyboard not found).
    console.error(`Startup failed: ${err.message}. The supervisor will restart the script.`);
    process.exit(1); // Exit with an error code.
});

process.on('unhandledRejection', (reason, promise) => {
    // This catches any error that happens AFTER successful startup (e.g., disconnect).
    console.error(`\n>>>> FATAL RUNTIME ERROR (likely disconnect): ${reason.message || reason}.`);
    console.error(">>>> The supervisor will restart the script.");
    process.exit(1); // Exit with an error code.
});

process.on('SIGINT', function () {
    // This handles a clean shutdown (Ctrl+C).
    console.log("SIGINT received, shutting down cleanly.");
    if (hidHandler.isStarted()) {
        hidHandler.stop();
    }
    process.exit(0); // Exit with a success code.
});