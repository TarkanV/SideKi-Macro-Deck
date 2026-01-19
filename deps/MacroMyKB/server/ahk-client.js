"use strict";
const net = require("net");

class AHKClient {
    constructor() {
        this.client = new net.Socket();
        this.connected = false;
        this.isConnecting = false;

        this.client.on('connect', () => {
            console.log('Connected to AHK server');
            this.connected = true;
            this.isConnecting = false;

              const connectionMessage = {
                type: "connectionStatus", // The crucial field for routing
                status: "connected",
                timestamp: Date.now()
            };

            // We still send it the same way, as a stringified JSON with a newline
            this.send(JSON.stringify(connectionMessage) + '\n');
        });

        this.client.on('close', () => {
            if (this.connected) {
                console.log('Connection to AHK server closed. Reconnecting...');
            }
            this.connected = false;
            this.isConnecting = false;
            setTimeout(() => this.connect(), 1000);
        });

        this.client.on('error', (err) => {
            // The 'close' event will handle reconnection.
        });
    }

    connect() {
        if (!this.connected && !this.isConnecting) {
            this.isConnecting = true;
            this.client.connect(8080, '127.0.0.1');
        }
    }

    send(message) {
        if (this.connected) {
            this.client.write(message, (err) => {
                if (err) {
                    const fs = require('fs');
                    const path = require('path');
                    //const logFile = path.join(__dirname, '..', 'mykb.log');
                    //fs.appendFileSync(logFile, `[MYKB] Write Error: ${err.message}\n`);
                }
            });
        }
    }
}

// Export a singleton instance
module.exports = new AHKClient();