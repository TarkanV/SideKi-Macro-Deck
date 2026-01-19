"use strict";

const ahkClient = require('./ahk-client');
Object.defineProperty(exports, "__esModule", { value: true });
const sendinput_1 = require("sendinput");
const hid_ps2_1 = require("./hid_ps2");
const events_1 = require("events");
var EventCond;
(function (EventCond) {
    EventCond[EventCond["down"] = 0] = "down";
    EventCond[EventCond["up"] = 1] = "up";
    EventCond[EventCond["press"] = 2] = "press";
})(EventCond = exports.EventCond || (exports.EventCond = {}));
var Contains;
(function (Contains) {
    Contains[Contains["no"] = 0] = "no";
    Contains[Contains["matches"] = 1] = "matches";
    Contains[Contains["containes"] = 2] = "containes";
})(Contains || (Contains = {}));
class Device {
    constructor(config) {
        this._events = [];
        this.ee = new events_1.EventEmitter();
        this.lastDataError = null;
        this.lastKeys = [];
        this._vendor = config.vendor;
        this._prod = config.prod;
        this._name = config.name;
        this._sn = config.sn;
        this._passthrough = config.passthrough;
        if (this.passthrough) {
            this.ee.on("up-down", (up, down) => this.passthroughKeys(up, down));
        }
    }
    get events() {
        return this._events.map(e => (Object.assign({}, e, { action: this })));
    }
    addEvent(keys, only, on, action) {
        this._events.push({ keys, only, on, action });
    }
    get vendor() { return this._vendor; }
    get prod() { return this._prod; }
    get sn() { return this._sn; }
    get name() { return this._name; }
    get passthrough() { return this._passthrough; }
    /**
     *
     * @param part
     * @param whole
     */
    checkContains(part, whole) {
        if (!part.every(e => whole.indexOf(e) > -1))
            return Contains.no;
        return part.length == whole.length ? Contains.matches : Contains.containes;
    }
    eventsMatching(pressed, ups, downs) {
        const fs = require('fs');
        const path = require('path');
       // const logFile = path.join(__dirname, '..', 'device.log');
        
       // fs.appendFileSync(logFile, `[Device] Checking events. Pressed: [${pressed}], Downs: [${downs}], Ups: [${ups}]\n`);

        const matchingEvents = this._events.filter(e => {
            let c = Contains.no;
            let match = false;
            switch (e.on) {
                case EventCond.down:
                    c = this.checkContains(e.keys, pressed);
                    if (c !== Contains.no && e.keys.some(k => downs.indexOf(k) > -1)) {
                        match = e.only ? c == Contains.matches : true;
                    }
                    break;
                case EventCond.up:
                    c = this.checkContains(e.keys, [...pressed, ...ups]);
                    if (c !== Contains.no && e.keys.some(k => ups.indexOf(k) > -1)) {
                        match = e.only ? c == Contains.matches : true;
                    }
                    break;
                case EventCond.press:
                    c = this.checkContains(e.keys, pressed);
                    if (c !== Contains.no) {
                        match = e.only ? c == Contains.matches : true;
                    }
                    break;
            }
           // fs.appendFileSync(logFile, `  - Event keys [${e.keys}] (on: ${e.on}, only: ${e.only}): ${match ? 'MATCH' : 'NO MATCH'}\n`);
            return match;
        });

       // fs.appendFileSync(logFile, `[Device] Found ${matchingEvents.length} matching events.\n\n`);
        return matchingEvents;
    }
    KBDEvent2Scancodes(event) {
        let modByte = event.data.readUInt8(0);
        let modifiers = [];
        for (let i = 0; i < 8; i++) {
            if ((modByte >> i) & 1)
                modifiers.push(0xe0 + i);
        }
        if (event.scancodes.length == 6 && event.scancodes[0] < 4 && event.scancodes.every(k => k == event.scancodes[0])) {
            if (event.scancodes[0] != this.lastDataError) { // only log one time
                if (event.scancodes[0] == 1)
                    console.info("Keyboard reports: Too many keys pressed");
                else
                    console.info("Keyboard sent errorcode", event.scancodes);
            }
            this.lastDataError = event.scancodes[0];
            return null;
        }
        this.lastDataError = null;
        return [...modifiers, ...event.scancodes];
    }
    KBDEventIn(event) {
        let keys = this.KBDEvent2Scancodes(event);
        if (keys == null)
            return;
        let pressed = keys;
        let ups = this.lastKeys.filter(k => (pressed).indexOf(k) == -1);
        let downs = pressed.filter(k => this.lastKeys.indexOf(k) == -1);
        
        
        /// --- MODIFIED FORWARDING LOGIC ---
        // For every key that goes down, send a "down" message to AHK.
        for (const key of downs) {
            // Create a structured object with a type
            const keyEvent = {
                type: "keyEvent", // <-- The new field for routing
                key: key,
                state: "down",
                pressed: pressed,  // The original "pressed" array is included
                device: {
                    name: this._name // <-- This is the only field we care about for this
                }
            };
            // Convert to a JSON string and send with a newline
            ahkClient.send(JSON.stringify(keyEvent) + '\n');
        }

        // For every key that goes up, send an "up" message to AHK.
        for (const key of ups) {
            // Create a structured object with a type
            const keyEvent = {
                type: "keyEvent", // <-- The new field for routing
                key: key,
                state: "up",
                pressed: pressed, // The original "pressed" array is included
                device: {
                    name: this._name // <-- This is the only field we care about for this
                }
            };
            // Convert to a JSON string and send with a newline
            ahkClient.send(JSON.stringify(keyEvent) + '\n');
        }
        // --- END OF MODIFIED LOGIC ---
        
        /*
        // emit events
        this.ee.emit("pressed", pressed, ups, downs, event);
        if (ups.length > 0)
            this.ee.emit("up", ups, event);
        if (downs.length > 0)
            this.ee.emit("down", downs, event);
        if (ups.length + downs.length > 0)
            this.ee.emit("up-down", ups, downs, event);
        // Run user actions
        if (pressed.length + ups.length > 0) {
            let evts = this.eventsMatching(pressed, ups, downs);
            for (let e of evts) {
                e.action.run(e, pressed);
            }
        }
        */

        this.lastKeys = pressed;

        // echo ups and downs
        if (ups.length > 0)
            console.log("up", ups);
        if (downs.length > 0)
            console.log("down", downs);
    }
    hid2ps2(k) {
        return k.map(hid => {
            let c = hid_ps2_1.hid2codes(hid);
            if (!c)
                console.warn("Unknown key: ", k);
            else if (!c.win)
                console.warn("Cannot convert 2 win: ", k);
            if (c && c.win != null)
                return c.win;
            else
                return null;
        }).filter(k => k != null);
    }
    passthroughKeys(ups, downs) {
        ups = this.hid2ps2(ups);
        downs = this.hid2ps2(downs);
        //TODO: repeat pressed keys
        sendinput_1.SendInput([
            ...ups.map(k => ({ type: 1, val: k, up: true })),
            ...downs.map(k => ({ type: 1, val: k }))
        ]);
    }
}
exports.Device = Device;
