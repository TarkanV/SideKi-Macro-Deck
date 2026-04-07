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
### 2. Running 
## Prerequisites
  - DISCLAIMER: Zadig is a powerful tool that replaces your device drivers. Please use it with caution and make sure to select the correct device corresponding to your secondary keyboard to avoid rendering other devices inoperable (it is entirely reversible, you just need to uninstall the driver).
  - Download and install [Zadig](https://zadig.akeo.ie/) to set up the secondary keyboard for interception.
    - Click on Options->List All Devices then : Click on the the device dropdown list and select your secondary keyboard (You can unplug and replug it to make sure you're selecting the right device).
    - Write down or keep in mind both fields next to USB ID 
      - The First Field > Vendor ID (VID)
      - The Second Field > Product ID (PID)
    - Select "WinUSB" in the drivers list with the small arrows and click "Install Driver" (or "Replace Driver" if it was previously configured with another driver). 
      - Important: After installing the driver, your secondary keyboard will stop working as a regular input device until you either configure it in Side-Ki (in the following steps) or uninstall the driver from Device Manager.
    
    - Open Side-Ki > direct your cursor to the left bar and click on the pencil icon ✏️ to edit the default keyboard profile.
    - Give a name to your device and input the USB ID fields you noted down from Zadig in their respective fields. 
    - Click on "Ok" to save the profile and click on "Run" to start intercepting keys from that device.
### 3. Restoring the original driver
- If you wish to restore the original driver for your secondary keyboard, you can do so through the Device Manager:
  - Open Device Manager (you can search for it in the Start menu).
  - Find your secondary keyboard :
    - It is most likely under Universal Serial Bus Devices.
    - Again, unplugging and replugging the device while observing the Device Manager can help you identify it.
  - Right-click on it and select "Properties".
  - Go to the "Driver" tab and click on "Roll Back Driver" if available, or "Uninstall Device". 
    - If you're lucky, Windows will automatically reinstall the original driver upon unplugging and replugging the device and you're good to go. If not, restart your computer and it should be back to normal. 


### Plan for Next Updates :
 - Synchronize program profile state in Side-Ki and AutoHotKey script.
 - Dark mode.
