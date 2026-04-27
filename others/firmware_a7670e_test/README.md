# A7670E SIMCom Module Test Firmware

Standalone ESP32 firmware to test the **SIMCom A7670E** LTE modem. Use this to verify wiring, AT communication, SIM, network registration, and SMS before running the full PoleTransMonitor firmware.

## Hardware

| A7670E | ESP32   |
|--------|---------|
| UART RX| GPIO 34 (RX1) |
| UART TX| GPIO 32 (TX1) |

- **Baud:** 115200 (A7670E default per SIMCom/Waveshare). Change `SIM_BAUD` in `include/config.h` to 9600 if your module uses 9600. The firmware can auto-try 9600 after 115200 fails (`SIM_TRY_9600_IF_FAIL`).
- If the modem does not respond, try `SIM_SWAP_RX_TX 1` in config (note: on ESP32, GPIO 34 is input-only, so swap only if TX is not on 34).

## Build & Run

```bash
cd firmware_a7670e_test
pio run
pio run -t upload
pio device monitor
```

## What It Tests

1. **AT** – Modem responds after boot wait (default 12 s).
2. **Modem info** – IMEI, ICCID (SIM).
3. **Network** – CSQ (signal), operator, registration.
4. **Wait for network** – Up to 90 s for registration.
5. **Test SMS** – Optional; set `ENABLE_TEST_SMS` and `TEST_SMS_RECIPIENT` in `include/config.h`.

After setup, the loop prints AT + CSQ every 30 seconds.

## Configuration

Edit `include/config.h`:

- `SIM_RX_PIN`, `SIM_TX_PIN`, `SIM_BAUD` – UART pins and baud (default **115200** for A7670E).
- `SIM_TRY_9600_IF_FAIL` – If 1, try 9600 baud when the default baud gets no AT response.
- `SIM_SWAP_RX_TX` – 1 if RX/TX appear swapped.
- `MODEM_BOOT_MS` – Delay after power before sending AT (e.g. 12000).
- `ENABLE_TEST_SMS`, `TEST_SMS_RECIPIENT`, `TEST_SMS_MESSAGE` – For sending a test SMS.

**If the modem never responds:** LILYGO boards recommend [TinyGSM-fork](https://github.com/lewisxhe/TinyGSM-fork). You can try replacing the TinyGSM dependency in `platformio.ini` with the fork; some A7670E variants may need it.

## TinyGSM

This project uses [TinyGSM](https://github.com/vshymanskyy/TinyGSM) with the **A7672X** modem profile (compatible with A7670E). Raw AT debug is enabled via `TINY_GSM_DEBUG=Serial` in `platformio.ini`.
