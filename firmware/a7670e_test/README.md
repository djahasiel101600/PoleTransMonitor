# SIMCom A7670E standalone test

Test sketch for SIMCom A7670E: power on, find working baud (9600/115200/57600/38400), run AT+CPIN?, optionally send one test SMS, then echo modem in loop.

## Config (top of `src/main.cpp`)

```cpp
#define MODEM_RX  16   // ESP32 RX  ← Modem TXD   (try 17, 25, 34)
#define MODEM_TX  17   // ESP32 TX  → Modem RXD   (try 16, 26, 32)
#define MODEM_PWR 4    // PWE_EN (0 = not used)
#define SEND_TEST_SMS  0
#define TEST_SMS_NUMBER "+639171234567"
```

Change `MODEM_RX` / `MODEM_TX` to match your wiring. Use **16/17** if that’s how you’ve wired the modem; **34/32** is also valid (34 = input-only, use as RX only).

## Wiring

- **Modem TXD** → **ESP32 RX** (MODEM_RX)
- **Modem RXD** ← **ESP32 TX** (MODEM_TX)
- **Modem PWE_EN** ← **GPIO 4** (LOW 1.5 s then HIGH to power on; set `MODEM_PWR 0` if not used)
- **GND**, **VCC** per your board

## Build & run

From `firmware/a7670e_test/`:

```bash
pio run
pio run -t upload
pio device monitor -b 115200
```

## What the sketch does

1. **[1]** Opens UART at 9600 (so it’s ready before modem boots).
2. **[2]** If `MODEM_PWR > 0`: drives PWE_EN pulse, waits, then drains and prints modem boot output (hex) for 8 s.
3. **[3]** Tries 9600, 115200, 57600, 38400: sends `AT`, waits for `OK`. Stops at first baud that works.
4. **[4]** Sends `AT+CPIN?` and prints the response.
5. **[5]** If `SEND_TEST_SMS` is 1, sends one SMS to `TEST_SMS_NUMBER`; otherwise skips.
6. **Loop:** echoes any bytes from the modem.

## If you never get AT OK

- Confirm **modem TXD** is connected to **ESP32 RX** (MODEM_RX) and **modem RXD** to **ESP32 TX** (MODEM_TX).
- Check power: A7670E often needs **3.4–4.2 V**; PWE_EN and GND must be correct.
- Verify the modem with a **USB‑TTL adapter** (modem TXD→adapter RXD, RXD←adapter TXD) at 9600 or 115200; you should see boot text and `AT` → `OK`.
- Try another pin pair (e.g. **16/17** or **34/32**) in case of a bad pin or wrong pad on the module.
