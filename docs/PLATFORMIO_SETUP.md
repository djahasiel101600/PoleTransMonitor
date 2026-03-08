# PlatformIO Setup Guide — Pole Transformer Monitor (ESP32)

This guide walks you through installing PlatformIO, configuring dependencies, and uploading firmware to your ESP32 for the **Pole Trans Monitor** project.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install PlatformIO](#2-install-platformio)
3. [Open the Firmware Project](#3-open-the-firmware-project)
4. [Understanding Dependencies](#4-understanding-dependencies)
5. [Install Dependencies](#5-install-dependencies)
6. [Configure Before Upload](#6-configure-before-upload)
7. [Upload to ESP32](#7-upload-to-esp32)
8. [Serial Monitor](#8-serial-monitor)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

- **ESP32 DevKit** or compatible board
- **USB cable** (data-capable, not charge-only)
- **Windows / macOS / Linux**

### Hardware Overview (Pole Trans Monitor)

| Component   | Purpose                     | Connection                 |
|------------|-----------------------------|----------------------------|
| PZEM-004T  | Voltage, current, power     | UART2: RX=16, TX=17        |
| MAX31865   | Oil temperature (RTD)       | SPI: MOSI=23, MISO=19, SCK=18, CS=5 |
| SIM A7670E | LTE / SMS                   | UART1: RX=34, TX=32 @ 115200 |

---

## 2. Install PlatformIO

Choose one of the following methods.

### Option A: PlatformIO IDE (VS Code Extension) — Recommended

1. Install [Visual Studio Code](https://code.visualstudio.com/) if you don’t have it.
2. Open VS Code and go to **Extensions** (Ctrl+Shift+X / Cmd+Shift+X).
3. Search for **PlatformIO IDE**.
4. Click **Install**.
5. Restart VS Code when prompted.

PlatformIO will install its own toolchain and Python environment; you do **not** need Arduino IDE.

### Option B: PlatformIO Core (CLI Only)

Install via pip:

```bash
pip install platformio
```

Or using the official script:

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py -o get-platformio.py
python3 get-platformio.py
```

After installation, use `pio` from the command line.

---

## 3. Open the Firmware Project

1. In VS Code: **File → Open Folder**
2. Choose the **`firmware`** folder:  
   `PoleTransMonitor/firmware`
3. PlatformIO will recognize the project and load it.

Or from CLI:

```bash
cd path/to/PoleTransMonitor/firmware
pio run
```

---

## 4. Understanding Dependencies

The project uses `platformio.ini` for configuration. Dependencies are listed in `lib_deps`:

| Library                          | Purpose                          |
|----------------------------------|----------------------------------|
| `mandulaj/PZEM-004T-v30`         | PZEM-004T energy monitor         |
| `adafruit/Adafruit MAX31865`     | RTD (oil temperature)            |
| `vshymanskyy/TinyGSM`            | GSM/LTE (A7670E via A7672X driver) |
| `bblanchon/ArduinoJson`          | JSON for backend API             |

Build flags include `-DTINY_GSM_MODEM_SIM7600` for the SIM7600 modem.

---

## 5. Install Dependencies

PlatformIO resolves and installs libraries automatically when you build.

- **VS Code**: Click the checkmark icon (PlatformIO: Build) or use the bottom toolbar.
- **CLI**:

```bash
cd firmware
pio run
```

The first build will download the platform (`espressif32`), board support, and all `lib_deps`. No manual install steps are needed.

---

## 6. Configure Before Upload

Before uploading, edit `firmware/include/config.h`:

| Setting            | Example               | Description                |
|--------------------|-----------------------|----------------------------|
| `WIFI_SSID`        | `"MyNetwork"`         | Your WiFi SSID             |
| `WIFI_PASSWORD`    | `"password123"`       | WiFi password              |
| `BACKEND_URL`      | `"http://192.168.1.100:8000"` | Backend API base URL |
| `TRANSFORMER_ID`   | `1`                   | Transformer ID             |
| `SMS_RECIPIENT`    | `"+639123456789"`     | Phone number for SMS       |
| `SAMPLE_INTERVAL_MS` | `5000`             | Sampling interval (ms)     |

Save the file after editing.

---

## 7. Upload to ESP32

### Step 1: Connect the ESP32

1. Plug the ESP32 into your PC with a USB cable.
2. Wait for drivers to install if needed (see [Troubleshooting](#9-troubleshooting)).

### Step 2: Upload

**VS Code**

- Bottom toolbar: click the **right arrow** (→) (Upload).
- Or **PlatformIO: Upload** from the command palette.

**CLI**

```bash
cd firmware
pio run -t upload
```

### Step 3: Selecting the Port (if needed)

If multiple ports exist:

**CLI**

```bash
pio run -t upload --upload-port COM3
```

On Windows, typical ports are `COM3`, `COM4`, etc. On macOS/Linux: `/dev/cu.usbserial-*` or `/dev/ttyUSB*`.

**VS Code**

1. Open `platformio.ini`.
2. Add under `[env:esp32dev]`:

```ini
upload_port = COM3
```

Replace `COM3` with your actual port.

### First Upload Time

The first upload may take longer while PlatformIO downloads tools. Later uploads are faster.

---

## 8. Serial Monitor

After upload, use the serial monitor for logs and debug output (115200 baud).

**VS Code**

- Bottom toolbar: plug icon (Monitor) or **PlatformIO: Monitor**.

**CLI**

```bash
pio device monitor
```

Exit: `Ctrl+C`.

---

## 9. Troubleshooting

### Port Not Detected (Windows)

- Install [CP210x USB drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) or [CH340 drivers](https://www.wch-ic.com/downloads/CH341SER_EXE.html) depending on your ESP32 board.
- Reconnect the board and check Device Manager for `COMx`.

### Port Not Detected (Linux)

Add yourself to the `dialout` group:

```bash
sudo usermod -a -G dialout $USER
```

Log out and back in, or reboot.

### Upload Failed: "Port busy" or "Permission denied"

- Close Arduino IDE, serial monitors, or other tools using the port.
- Unplug and replug the ESP32.

### Build Errors: Missing Libraries

```bash
pio pkg install
pio run
```

### ESP32 Not in Boot Mode

Some boards require **BOOT** held during reset for upload:

1. Hold **BOOT**.
2. Press **RESET** briefly.
3. Release **BOOT**.
4. Start the upload immediately.

### Wrong Board Type

`platformio.ini` uses `board = esp32dev`. For other ESP32 boards (e.g. ESP32-S3, ESP32-C3), change the board or add a new `[env:...]` block in `platformio.ini` and build for that environment.

### Modem `testAT=FAIL` (A7670E No Response)

If `[DEBUG SIM] init done, testAT=FAIL` appears, the modem is not responding. Try in `config.h`:

1. **Swap RX/TX** — set `SIM_SWAP_RX_TX` to `1` only if TX is *not* on GPIO 34 (ESP32: 34/35/36/39 are input-only). Otherwise swap wires physically.
2. **Change baud** — try `SIM_BAUD 9600` instead of 115200.
3. **Check wiring** — ESP32 RX (GPIO 34) → modem TX; ESP32 TX (GPIO 32) → modem RX.
4. **Power** — A7670E needs stable 3.3V/4V; ensure adequate current (peaks ~2A).

---

## Quick Reference

| Action      | VS Code              | CLI                     |
|------------|----------------------|-------------------------|
| Build      | Build button (checkmark) | `pio run`           |
| Upload     | Upload button (→)    | `pio run -t upload`     |
| Monitor    | Monitor button (plug) | `pio device monitor`   |
| Clean      | Clean button         | `pio run -t clean`      |
| List ports | —                    | `pio device list`       |

---

## Project Structure

```
firmware/
├── platformio.ini      # PlatformIO config (board, deps, flags)
├── include/
│   └── config.h        # Wi‑Fi, backend, SMS, sampling
└── src/
    ├── main.cpp
    ├── sensors/        # PZEM-004T, MAX31865
    ├── connectivity/   # Wi‑Fi, backend, SIM A7670E
    └── fault/          # Thresholds, alerts
```

For backend and frontend setup, see the main [README.md](../README.md).
