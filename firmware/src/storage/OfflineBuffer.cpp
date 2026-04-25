#include "OfflineBuffer.h"
#include "config.h"
#include <ArduinoJson.h>
#include <LittleFS.h>

const char *OfflineBuffer::BUFFER_FILE = "/readings.buf";

bool OfflineBuffer::begin()
{
    // true = format partition on first mount failure (clears any corruption).
    if (!LittleFS.begin(true))
    {
#if DEBUG_SERIAL
        Serial.println("[OfflineBuffer] LittleFS mount failed");
#endif
        mounted_ = false;
        return false;
    }
    mounted_ = true;
#if DEBUG_SERIAL
    Serial.println("[OfflineBuffer] LittleFS mounted");
#endif
    return true;
}

void OfflineBuffer::push(const ReadingPayload &payload, uint32_t epochSec)
{
    if (!mounted_ || epochSec == 0)
        return;

    // Guard against exceeding the cap.
    if (LittleFS.exists(BUFFER_FILE))
    {
        File f = LittleFS.open(BUFFER_FILE, "r");
        if (f)
        {
            size_t sz = f.size();
            f.close();
            if (sz >= OFFLINE_BUFFER_MAX_BYTES)
            {
#if DEBUG_SERIAL
                Serial.println("[OfflineBuffer] Buffer full — dropping offline reading");
#endif
                return;
            }
        }
    }

    // Serialize compact JSON with abbreviated keys to minimise flash writes.
    JsonDocument doc;
    doc["ts"] = epochSec;
    doc["v"] = payload.voltage;
    doc["a"] = payload.current;
    doc["va"] = payload.apparentPower;
    if (!isnan(payload.realPower) && payload.realPower >= 0.0f)
        doc["w"] = payload.realPower;
    if (!isnan(payload.powerFactor) && payload.powerFactor >= 0.0f && payload.powerFactor <= 1.0f)
        doc["pf"] = payload.powerFactor;
    doc["hz"] = payload.frequency;
    if (!isnan(payload.oilTemp))
        doc["ot"] = payload.oilTemp;
    if (!isnan(payload.energyKwh) && payload.energyKwh >= 0.0f)
        doc["kwh"] = payload.energyKwh;
    doc["cond"] = payload.condition ? payload.condition : "normal";

    File f = LittleFS.open(BUFFER_FILE, "a");
    if (!f)
    {
#if DEBUG_SERIAL
        Serial.println("[OfflineBuffer] Failed to open buffer file for append");
#endif
        return;
    }

    serializeJson(doc, f);
    f.print('\n');
    f.close();

#if DEBUG_SERIAL
    Serial.printf("[OfflineBuffer] Buffered reading ts=%u\n", epochSec);
#endif
}

bool OfflineBuffer::hasPending()
{
    if (!mounted_)
        return false;
    if (!LittleFS.exists(BUFFER_FILE))
        return false;
    File f = LittleFS.open(BUFFER_FILE, "r");
    if (!f)
        return false;
    bool hasData = (f.size() > 0);
    f.close();
    return hasData;
}

void OfflineBuffer::replayAll(BackendClient &client, unsigned int delayMs)
{
    if (!mounted_ || !hasPending())
        return;

    File f = LittleFS.open(BUFFER_FILE, "r");
    if (!f)
    {
#if DEBUG_SERIAL
        Serial.println("[OfflineBuffer] Failed to open buffer file for replay");
#endif
        return;
    }

    size_t total = 0;
    size_t sent = 0;
    bool aborted = false;

    while (f.available())
    {
        String line = f.readStringUntil('\n');
        line.trim();
        if (line.length() == 0)
            continue;

        total++;

        JsonDocument doc;
        if (deserializeJson(doc, line))
        {
#if DEBUG_SERIAL
            Serial.printf("[OfflineBuffer] Skipping malformed line %u\n", (unsigned)total);
#endif
            continue; // skip corrupt lines
        }

        uint32_t epochSec = doc["ts"] | (uint32_t)0;
        if (epochSec == 0)
            continue;

        ReadingPayload p;
        p.transformerId = client.getTransformerId();
        p.voltage = doc["v"] | (float)NAN;
        p.current = doc["a"] | (float)NAN;
        p.apparentPower = doc["va"] | (float)NAN;
        p.realPower = doc["w"] | (float)NAN;
        p.powerFactor = doc["pf"] | (float)NAN;
        p.frequency = doc["hz"] | (float)NAN;
        p.oilTemp = doc["ot"] | (float)NAN;
        p.energyKwh = doc["kwh"] | (float)NAN;

        // condition is a short string; ArduinoJSON keeps the string in the doc pool.
        static char condBuf[32];
        const char *cond = doc["cond"] | "normal";
        strncpy(condBuf, cond, sizeof(condBuf) - 1);
        condBuf[sizeof(condBuf) - 1] = '\0';
        p.condition = condBuf;

        int code = client.postReadingWithTimestamp(p, epochSec);
        if (code >= 200 && code < 300)
        {
            sent++;
#if DEBUG_SERIAL
            Serial.printf("[OfflineBuffer] Replayed %u/%u ts=%u HTTP %d\n",
                          (unsigned)sent, (unsigned)total, epochSec, code);
#endif
        }
        else
        {
#if DEBUG_SERIAL
            Serial.printf("[OfflineBuffer] POST failed (HTTP %d) — aborting replay\n", code);
#endif
            aborted = true;
            break;
        }

        if (delayMs > 0)
            delay(delayMs);
    }

    f.close();

    if (!aborted)
    {
        LittleFS.remove(BUFFER_FILE);
#if DEBUG_SERIAL
        Serial.printf("[OfflineBuffer] Replay complete: %u entries sent, buffer cleared\n",
                      (unsigned)sent);
#endif
    }
    else
    {
#if DEBUG_SERIAL
        Serial.printf("[OfflineBuffer] Replay aborted after %u/%u entries; buffer kept for next reconnect\n",
                      (unsigned)sent, (unsigned)total);
#endif
    }
}

void OfflineBuffer::clear()
{
    if (mounted_)
        LittleFS.remove(BUFFER_FILE);
}
