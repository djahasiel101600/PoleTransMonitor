# Device config sync (ESP32 ↔ dashboard)

The **dashboard** is the source of truth for nameplate / monitoring parameters:

- `nominal_voltage`, `nominal_freq`, `rated_kva`, `rated_current`

The ESP32 **ThresholdEvaluator** (local condition strings before POSTing readings) should use the **same** values.

## How it works

1. Each `Transformer` has an auto-generated **`device_api_key`** (staff-only in API).
2. Staff copies the key into the WiFi portal field **Device API key (Dashboard → staff)**.
3. On boot and every **15 minutes** (see `DEVICE_CONFIG_REFRESH_MS` in `firmware/include/config.h`), firmware calls:

   `GET {BACKEND_URL}/api/transformers/{id}/device_config/`  
   Header: `X-Device-Key: <device_api_key>`

4. The JSON response updates **NVS cache** and the in-memory thresholds used by `ThresholdEvaluator`.

## Security

- The endpoint is **unauthenticated with JWT**; access is **only** via `X-Device-Key` matching that transformer’s stored key (constant-time compare).
- Treat the key like a password for that device’s config channel.

## If sync fails

Firmware keeps the **last successful** profile in NVS, or falls back to `config.h` defaults (`NOMINAL_VOLTAGE`, etc.) until a fetch succeeds.
