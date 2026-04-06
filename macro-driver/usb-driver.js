"use strict";
const { usb, getDeviceList } = require('usb');
const EventEmitter = require('events');

class USBKeyboardManager extends EventEmitter {
    constructor() {
        super();
        this.configs =[]; 
        this.activeDevices = new Map(); 
        this.lastKeys = new Map(); 
        this.isRunning = false;
        
        // Track Local Lock States
        this.lockStates = { caps: false, num: false, scroll: false };
    }

    start(configs) {
        if (this.isRunning) return;
        this.configs = configs;
        this.isRunning = true;

        const devices = getDeviceList();
        for (const dev of devices) {
            this.tryAttachDevice(dev);
        }

        usb.on('attach', (dev) => this.tryAttachDevice(dev));
        usb.on('detach', (dev) => this.handleDetach(dev));
        
        console.log("[Macro Driver] Passive USB listener started successfully.");
    }

    async tryAttachDevice(dev, retryCount = 0) {
        const vid = dev.deviceDescriptor.idVendor;
        const pid = dev.deviceDescriptor.idProduct;
        
        const config = this.configs.find(c => parseInt(c.vendor, 16) === vid && parseInt(c.prod, 16) === pid);
        if (!config) return; 

        const deviceKey = `${vid}:${pid}`;
        if (this.activeDevices.has(deviceKey)) return;

        try {
            dev.open();
            
            let inEndpoint = null;
            let outEndpoint = null; // NEW: Track the OUT endpoint for safe LED control
            let claimedIface = null;

            for (let iface of dev.interfaces) {
                try {
                    if (process.platform !== "win32" && iface.isKernelDriverActive()) {
                        iface.detachKernelDriver();
                    }
                    iface.claim();
                    
                    inEndpoint = iface.endpoints.find(e => e.direction === 'in');
                    outEndpoint = iface.endpoints.find(e => e.direction === 'out'); // Look for dedicated OUT pipe
                    
                    if (inEndpoint) {
                        claimedIface = iface;
                        break; 
                    } else {
                        iface.release(true, () => {});
                    }
                } catch (e) { }
            }

            if (!inEndpoint) {
                console.warn(`[Macro Driver] Could not find an IN endpoint for ${config.name}`);
                dev.close();
                throw new Error("Endpoint not ready"); 
            }

            console.log(`[Macro Driver] Hooked Keyboard: ${config.name} (${vid.toString(16)}:${pid.toString(16)})`);
            if (outEndpoint) {
                console.log(`[Macro Driver] Found dedicated OUT endpoint for LEDs on ${config.name}`);
            }
            
            // Store all the endpoint data securely
            const deviceData = { dev, claimedIface, inEndpoint, outEndpoint, config };
            this.activeDevices.set(deviceKey, deviceData);
            this.lastKeys.set(deviceKey,[]);

            inEndpoint.startPoll(1, 8); 
            inEndpoint.on('data', (dataBuffer) => this.handleData(deviceKey, dataBuffer));
            
            inEndpoint.on('error', (err) => {
                // Ignore silent detach errors to prevent console spam
                if (!err.message.includes("LIBUSB_TRANSFER_NO_DEVICE")) {
                    console.error(`[Macro Driver] Endpoint Error for ${config.name}:`, err.message);
                }
                this.handleDetach(dev);
            });

           
            console.log(`[Macro Driver] SUCCESS: ${config.name} Hooked.`);

            this.updateLEDsForDevice(deviceData);

             const statusObj = { type: "connectionStatus", status: "connected", deviceName: config.name };

            this.emit('status', statusObj);   

        } catch (err) {
            if (retryCount < 5) {
                setTimeout(() => this.tryAttachDevice(dev, retryCount + 1), 1000);
            } else {
                console.error(`[Macro Driver] Could not claim ${config.name}:`, err.message);
            }
        }
    }

    handleDetach(dev) {
        const vid = dev.deviceDescriptor.idVendor;
        const pid = dev.deviceDescriptor.idProduct;
        const deviceKey = `${vid}:${pid}`;

        if (this.activeDevices.has(deviceKey)) {
            const { config, inEndpoint, claimedIface } = this.activeDevices.get(deviceKey);
            console.log(`[Macro Driver] Keyboard disconnected: ${config.name}`);
            
            try {
                inEndpoint.stopPoll(); 
                inEndpoint.removeAllListeners();
                claimedIface.release(true, () => {
                    try { dev.close(); } catch(e) {}
                });
            } catch(e) { }
            
            this.activeDevices.delete(deviceKey);
            this.emit('status', { status: 'disconnected', name: config.name });
            this.lastKeys.delete(deviceKey);
        }
    }

    async stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        
        for (let[deviceKey, keys] of this.lastKeys.entries()) {
            if (this.activeDevices.has(deviceKey)) {
                const config = this.activeDevices.get(deviceKey).config;
                for (const k of keys) {
                    this.sendAhkEvent(config.name, k, "up", []);
                }
            }
        }

        const closePromises = [];
        for (let[deviceKey, data] of this.activeDevices.entries()) {
            closePromises.push(new Promise((resolve) => {
                try {
                    data.inEndpoint.stopPoll(() => {
                        data.inEndpoint.removeAllListeners();
                        data.claimedIface.release(true, () => {
                            try { data.dev.close(); } catch(e) {}
                            resolve();
                        });
                    });
                } catch(e) { resolve(); }
            }));
        }
        
        await Promise.all(closePromises); 
        this.activeDevices.clear();
        this.lastKeys.clear();
        
        usb.removeAllListeners('attach');
        usb.removeAllListeners('detach');

        console.log("[Macro Driver] Stopped.");
        this.emit('status', { status: 'offline' });
    }

    handleData(deviceKey, dataBuffer) {
        // === PRECISE CHANGE: Robust Try/Catch to prevent N-API panics ===
        try {
            if (dataBuffer.length < 8) return;

            const { config } = this.activeDevices.get(deviceKey);
            
            let modByte = dataBuffer.readUInt8(0);
            let modifiers =[];
            for (let i = 0; i < 8; i++) {
                if ((modByte >> i) & 1) modifiers.push(0xe0 + i);
            }

            let scancodes =[];
            for (let i = 2; i < 8; i++) {
                let code = dataBuffer.readUInt8(i);
                if (code > 3) scancodes.push(code); 
            }

            if (dataBuffer.readUInt8(2) === 1) return; 

            let currentKeys =[...modifiers, ...scancodes];
            let lastKeys = this.lastKeys.get(deviceKey) ||[];

            let ups = lastKeys.filter(k => !currentKeys.includes(k));
            let downs = currentKeys.filter(k => !lastKeys.includes(k));
            let ledChanged = false;

            for (const key of downs) {
                if (key === 57) { this.lockStates.caps = !this.lockStates.caps; ledChanged = true; }
                if (key === 83) { this.lockStates.num = !this.lockStates.num; ledChanged = true; }
                if (key === 71) { this.lockStates.scroll = !this.lockStates.scroll; ledChanged = true; }
                this.sendAhkEvent(config.name, key, "down", currentKeys);
            }
            
            for (const key of ups) {
                this.sendAhkEvent(config.name, key, "up", currentKeys);
            }

            if (ledChanged) {
                this.updateAllLEDs();
            }

            this.lastKeys.set(deviceKey, currentKeys);
            
        } catch (err) {
            console.error("[Macro Driver] Safely caught error in handleData:", err.message);
        }
    }

    sendAhkEvent(deviceName, key, state, pressed) {
        const keyEvent = { type: "keyEvent", key: key, state: state, pressed: pressed, device: { name: deviceName } };
        this.emit('key', keyEvent);
    }

    getConnectedDevices() {
        return Array.from(this.activeDevices.values()).map(d => d.config.name);
    }

    updateAllLEDs() {
        for (let [deviceKey, data] of this.activeDevices.entries()) {
            
                this.updateLEDsForDevice(data);
            
        }
    }

    // === PRECISE CHANGE: Safe LED Routing ===
    updateLEDsForDevice(deviceData) {
        const { dev, claimedIface, outEndpoint, config } = deviceData;
        
        let mask = 0;
        if (this.lockStates.num && !config.ignoreNumLock) mask |= 1; 
        if (this.lockStates.caps) mask |= 2;
        if (this.lockStates.scroll) mask |= 4;
        
        const buffer = Buffer.from([mask]);

        try {
            if (outEndpoint) {
                // Route 1: Safe Interrupt OUT pipe (For Gaming/Modern Keyboards)
                outEndpoint.transfer(buffer, (err) => {
                    if (err) console.error("[Macro Driver] OUT pipe LED error:", err.message);
                });
            } else {
                // Route 2: Fallback Control Transfer (For Basic Keyboards)
                dev.controlTransfer(0x21, 0x09, 0x0200, claimedIface.interfaceNumber, buffer, (err) => {
                    // Ignored silently to prevent N-API warnings
                });
            }
        } catch (e) { }
    }

    setLockStates(states) {
        this.lockStates = {
            caps: states.caps ?? this.lockStates.caps,
            num: states.num ?? this.lockStates.num,
            scroll: states.scroll ?? this.lockStates.scroll
        };
        console.log("[Macro Driver] Synced Lock States with OS:", this.lockStates);
        this.updateAllLEDs();
    }
}

module.exports = new USBKeyboardManager();