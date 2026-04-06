# SideKi-Macro-Deck
 AutoHotKey and MultiKB GUI tool for assigning macro commands to secondary keyboard (or eventually numpad).

## Build & Run Instructions

### 1. Build
- **Install [Node.js](https://nodejs.org/)** 
- **Clone** this repository:
  ```bash
  git clone https://github.com/TarkanV/SideKi-Macro-Deck.git
  cd SideKi-Macro-Deck
  ```
- **Install dependencies**:
  ```bash
  npm install
  ```
- **Run the project**:
  ```bash
  npm run start
  ``` 
- **Build the project**:
  ```bash
  npm run package
  ```
### 2. Prerequisites
  - DISCLAIMER: Zadig is a powerful tool that replaces your device drivers. Please use it with caution and make sure to select the correct device corresponding to your secondary keyboard to avoid rendering other devices inoperable (thankfully it is reversible in most cases).
  - Download and install [Zadig](https://zadig.akeo.ie/) to set up the secondary keyboard for interception.
    - Click on Options->List All Devices, and find your secondary keyboard in the dropdown list (You can unplug and replug it to make sure you're selecting the right device).
    - Select "WinUSB" in the drivers list with the small arrows and click "Install Driver" (or "Replace Driver" if it was previously configured with another driver). 
    - Write down the first field next to USB ID

### 3.0
- X New Driver Interception mode 
- X Modifier key passthrough
- X Minimize to tray
- X Syntax highlight 


### V2.0
X Now only intercepts keys which are assigned on the configured keyboard.


### Plan for Next Updates :
 X Moving key's content around
 X multiple keyboards configuration 
