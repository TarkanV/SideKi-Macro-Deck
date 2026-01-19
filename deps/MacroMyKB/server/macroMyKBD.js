"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hidHandler = require('hid-handler');

class MacroMyKBD {
    constructor() {
        this._actions = [];
        this._devices = [];
    }
    get devices() { return [...this._devices]; }
    addDevice(d) {
        this._devices.push(d);
    }
    findDevice(vendor, prod, sn) {
        return this.devices.find(d => d.vendor == vendor && d.prod == prod && (!sn || d.sn == sn));
    }
    handleKey(e) {
        if (!hidHandler.isStarted()) return;

        let { vendorId, productId } = e.hid.deviceKey;
        let device = this.findDevice(parseInt(vendorId, 16), parseInt(productId, 16));
        if (device) {
            device.KBDEventIn(e);
        }
    }
    async start() {
        // This start() function is still needed to initialize the HID polling for THIS instance.
        hidHandler.init({
            supportedDevices: this.devices.map(d => ({
                name: d.name,
                type: 'keyboard',
                vendorId: d.vendor,
                productId: d.prod
            }))
        });
        // We are using our patched hid-handler that reliably throws an error on failure.
        await hidHandler.start();
    }
    stop() {
        // The stop function is still useful for a clean, user-initiated shutdown (Ctrl+C).
        try {
            if (hidHandler.isStarted()) {
                hidHandler.stop();
            }
        } catch (e) {
            console.warn("Warning during stop, which is expected on disconnect.", e.message);
        }
    }
}
exports.MacroMyKBD = MacroMyKBD;