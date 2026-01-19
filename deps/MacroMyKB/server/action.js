"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const device_1 = require("./device");
const ahkClient = require('./ahk-client');

class Action {
}
exports.Action = Action;

class Command extends Action {
    constructor(_cmd) {
        super();
        this._cmd = _cmd;
        // Connection is now managed by the ahk-client singleton.
    }
    
    get cmd() { return this._cmd; }
    
    run(evt, pressed) {
        let on = "__ERROR__";
        for (let i in device_1.EventCond) {
            if (device_1.EventCond[i] == evt.on) {
                on = i;
                break;
            }
        }
        const fs = require('fs');
        const path = require('path');
      //  const logFile = path.join(__dirname, '..', 'mykb.log');

         const keyEvent = {
            type: "keyEvent",             // The new field for routing
            key: evt.keys.join(" "),      // <-- YOUR ORIGINAL LOGIC, UNCHANGED.
            state: on,
            device: {
                    name: this._name // <-- This is the only field we care about for this
            }
        };

        const message = JSON.stringify(keyEvent) + '\n';
       
      //  fs.appendFileSync(logFile, `[MYKB] Sending: ${message}\n`);
        
        try {
            // Use the shared client to send the message
            ahkClient.send(message);
        } catch (e) {
            //fs.appendFileSync(logFile, `[MYKB] Write Exception: ${e.message}\n`);
        }
    }
}
exports.Command = Command;