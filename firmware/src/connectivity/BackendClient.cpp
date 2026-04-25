#include "BackendClient.h"
#include "../config/ConfigManager.h"
#include "config.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>

static const char *NVS_BC_NAMESPACE = "ptm_bc";
static const char *KEY_SYNC_EPOCH   = "time_epoch";
static const char *KEY_SYNC_MS      = "time_ms";

void BackendClient::begin(const char *baseUrl, int transformerId)
{
  strncpy(baseUrl_, baseUrl, sizeof(baseUrl_) - 1);
  baseUrl_[sizeof(baseUrl_) - 1] = '\0';
  transformerId_ = transformerId;

  // Restore last time-sync from NVS so we can estimate timestamps after a reboot.
  Preferences prefs;
  if (prefs.begin(NVS_BC_NAMESPACE, true))
  {
    syncEpoch_  = prefs.getUInt(KEY_SYNC_EPOCH, 0);
    syncMillis_ = prefs.getUInt(KEY_SYNC_MS,    0);
    // After a reboot millis() restarts from 0 but syncMillis_ still holds the
    // old value.  Reset syncMillis_ to 0 so getEstimatedEpoch() starts from
    // the stored epoch and advances with the new millis() counter.
    syncMillis_ = 0;
    prefs.end();
  }
}

bool BackendClient::postReading(const ReadingPayload &payload)
{
  int code = postReadingWithStatus(payload);
  return code >= 200 && code < 300;
}

int BackendClient::postReadingWithStatus(const ReadingPayload &payload)
{
  if (WiFi.status() != WL_CONNECTED)
    return -1;

  HTTPClient http;
  char url[192];
  snprintf(url, sizeof(url), "%s/api/readings/", baseUrl_);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["transformer_id"] = payload.transformerId;
  doc["voltage"] = payload.voltage;
  doc["current"] = payload.current;
  doc["apparent_power"] = payload.apparentPower;
  if (!isnan(payload.realPower))
  {
    doc["real_power"] = payload.realPower >= 0.0f ? payload.realPower : 0.0f;
  }
  // Only send power_factor when valid (0–1); NaN is not valid JSON
  if (!isnan(payload.powerFactor) && payload.powerFactor >= 0.0f && payload.powerFactor <= 1.0f)
  {
    doc["power_factor"] = payload.powerFactor;
  }
  doc["frequency"] = payload.frequency;
  doc["oil_temp"] = payload.oilTemp;
  // Always send energy_kwh when we have a valid number (0 or positive); dashboard shows cumulative kWh
  if (!isnan(payload.energyKwh))
  {
    doc["energy_kwh"] = payload.energyKwh >= 0.0f ? payload.energyKwh : 0.0f;
  }
  doc["condition"] = payload.condition;

  char body[420];
  size_t len = serializeJson(doc, body);

  int code = http.POST((uint8_t *)body, len);
  http.end();
  return code;
}

int BackendClient::postReadingWithTimestamp(const ReadingPayload &payload, uint32_t epochSec)
{
  if (WiFi.status() != WL_CONNECTED)
    return -1;

  // Build ISO-8601 UTC timestamp string: "2026-04-25T10:30:00Z"
  char tsBuf[32];
  time_t t = (time_t)epochSec;
  struct tm tmInfo;
  gmtime_r(&t, &tmInfo);
  strftime(tsBuf, sizeof(tsBuf), "%Y-%m-%dT%H:%M:%SZ", &tmInfo);

  HTTPClient http;
  char url[192];
  snprintf(url, sizeof(url), "%s/api/readings/", baseUrl_);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Use a doc large enough to hold the timestamp string.
  JsonDocument doc;
  doc["transformer_id"] = payload.transformerId;
  doc["timestamp"]      = tsBuf;
  doc["voltage"]        = payload.voltage;
  doc["current"]        = payload.current;
  doc["apparent_power"] = payload.apparentPower;
  if (!isnan(payload.realPower))
    doc["real_power"] = payload.realPower >= 0.0f ? payload.realPower : 0.0f;
  if (!isnan(payload.powerFactor) && payload.powerFactor >= 0.0f && payload.powerFactor <= 1.0f)
    doc["power_factor"] = payload.powerFactor;
  doc["frequency"] = payload.frequency;
  doc["oil_temp"]   = payload.oilTemp;
  if (!isnan(payload.energyKwh))
    doc["energy_kwh"] = payload.energyKwh >= 0.0f ? payload.energyKwh : 0.0f;
  doc["condition"] = payload.condition;

  char body[480];
  size_t len = serializeJson(doc, body);
  int code = http.POST((uint8_t *)body, len);
  http.end();
  return code;
}

bool BackendClient::fetchDeviceConfig(const char *deviceKey, ConfigManager &cm, const char *simPhoneNumber,
                                      bool *pendingEnergyReset, bool *pendingOpenPortal)
{
  if (WiFi.status() != WL_CONNECTED)
    return false;
  if (!deviceKey || !deviceKey[0])
    return false;

  HTTPClient http;
  char url[192];
  snprintf(url, sizeof(url), "%s/api/transformers/%d/device_config/", baseUrl_, transformerId_);
  http.begin(url);
  http.addHeader("X-Device-Key", deviceKey);
  if (simPhoneNumber && simPhoneNumber[0])
  {
    http.addHeader("X-Sim-Phone", simPhoneNumber);
  }

  int code = http.GET();
  if (code != 200)
  {
#if DEBUG_SERIAL
    Serial.printf("[DEBUG] GET device_config HTTP %d\n", code);
#endif
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err)
  {
#if DEBUG_SERIAL
    Serial.println("[DEBUG] device_config JSON parse error");
#endif
    return false;
  }

  float nv = doc["nominal_voltage"] | 0.0f;
  float nf = doc["nominal_freq"] | 0.0f;
  float rkva = doc["rated_kva"] | 0.0f;
  float ri = doc["rated_current"] | 0.0f;
  float rva = doc["rated_apparent_power_va"] | 0.0f;
  bool isActive = doc["is_active"] | true;

  if (nv <= 0.0f || rkva <= 0.0f)
  {
#if DEBUG_SERIAL
    Serial.println("[DEBUG] device_config missing nominal_voltage or rated_kva");
#endif
    return false;
  }
  if (rva <= 0.0f)
  {
    rva = rkva * 1000.0f;
  }
  if (nf <= 0.0f)
  {
    nf = NOMINAL_FREQUENCY;
  }
  if (ri <= 0.0f)
  {
    ri = RATED_CURRENT;
  }

  // SMS recipients come from backend device_config.
  // Firmware expects a CSV string so it can iterate recipients on alert.
  {
    char csv[ConfigManager::SMS_RECIPIENTS_CSV_MAX];
    csv[0] = '\0';
    size_t off = 0;

    JsonArray rec = doc["sms_recipients"].as<JsonArray>();
    if (!rec.isNull())
    {
      for (size_t i = 0; i < rec.size(); i++)
      {
        const char *p = rec[i].as<const char *>();
        if (!p || !p[0])
          continue;
        if (off > 0)
        {
          off += snprintf(csv + off, sizeof(csv) - off, ",");
        }
        off += snprintf(csv + off, sizeof(csv) - off, "%s", p);
        if (off >= sizeof(csv))
          break;
      }
    }

    cm.setSmsRecipientsCsv(csv);
  }

  cm.setActive(isActive);
  cm.setCachedProfile(nv, nf, ri, rva);

  // Transformer name (used to fill {transformer} token in SMS templates).
  {
    const char *name = doc["name"] | "";
    cm.setTransformerName(name);
  }

  // Global SMS templates from backend. Empty string = use firmware built-in default.
  {
    const char *alertTpl = doc["sms_alert_template"] | "";
    cm.setSmsAlertTemplate(alertTpl);
    const char *statusTpl = doc["sms_status_template"] | "";
    cm.setSmsStatusTemplate(statusTpl);
#if DEBUG_SERIAL
    if (alertTpl && alertTpl[0])
      Serial.printf("[DEBUG] SMS alert template: %s\n", alertTpl);
    if (statusTpl && statusTpl[0])
      Serial.printf("[DEBUG] SMS status template: %s\n", statusTpl);
#endif
  }

  if (pendingEnergyReset)
  {
    *pendingEnergyReset = doc["pending_energy_reset"] | false;
  }

  if (pendingOpenPortal)
  {
    *pendingOpenPortal = doc["pending_open_portal"] | false;
  }

  return true;
}

bool BackendClient::ackEnergyReset(const char *deviceKey)
{
  if (WiFi.status() != WL_CONNECTED)
    return false;

  HTTPClient http;
  char url[192];
  snprintf(url, sizeof(url), "%s/api/transformers/%d/ack_energy_reset/", baseUrl_, transformerId_);
  http.begin(url);
  http.addHeader("X-Device-Key", deviceKey);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST("{}");
  http.end();
  return code >= 200 && code < 300;
}

bool BackendClient::ackPortalOpen(const char *deviceKey)
{
  if (WiFi.status() != WL_CONNECTED)
    return false;

  HTTPClient http;
  char url[192];
  snprintf(url, sizeof(url), "%s/api/transformers/%d/ack_portal_open/", baseUrl_, transformerId_);
  http.begin(url);
  http.addHeader("X-Device-Key", deviceKey);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST("{}");
  http.end();
  return code >= 200 && code < 300;
}

bool BackendClient::fetchCurrentFirmware(char *outVersion, size_t vLen, char *outUrl, size_t uLen)
{
  if (WiFi.status() != WL_CONNECTED)
    return false;

  HTTPClient http;
  char url[192];
  snprintf(url, sizeof(url), "%s/api/firmware/current/", baseUrl_);
  http.begin(url);

  int code = http.GET();
  if (code != 200)
  {
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  // 512 bytes: production URLs (e.g. Render.com) can be 150+ chars and
  // ArduinoJSON v6 copies string values into the pool.
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err)
    return false;

  const char *ver = doc["version"] | "";
  const char *dl = doc["url"] | "";
  if (!ver[0] || !dl[0])
    return false;

  strncpy(outVersion, ver, vLen - 1);
  outVersion[vLen - 1] = '\0';
  strncpy(outUrl, dl, uLen - 1);
  outUrl[uLen - 1] = '\0';
  return true;
}

bool BackendClient::syncServerTime()
{
  if (WiFi.status() != WL_CONNECTED)
    return false;

  HTTPClient http;
  char url[192];
  snprintf(url, sizeof(url), "%s/api/health/", baseUrl_);
  http.begin(url);
  int code = http.GET();
  if (code != 200)
  {
    http.end();
    return false;
  }

  String body = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, body))
    return false;

  // /api/health/ returns {"timestamp": <float unix epoch>}
  double ts = doc["timestamp"] | 0.0;
  if (ts < 1000000000.0)
    return false; // Sanity check: epoch must be after 2001.

  uint32_t captured = millis();
  syncEpoch_  = (uint32_t)ts;
  syncMillis_ = captured;

  // Persist so estimates survive a reboot during the offline period.
  Preferences prefs;
  if (prefs.begin(NVS_BC_NAMESPACE, false))
  {
    prefs.putUInt(KEY_SYNC_EPOCH, syncEpoch_);
    // Store 0 for syncMillis_ so after reboot we start from epoch without drift.
    prefs.putUInt(KEY_SYNC_MS, 0);
    prefs.end();
  }

#if DEBUG_SERIAL
  Serial.printf("[DEBUG] Server time synced: epoch=%u (millis=%u)\n", syncEpoch_, syncMillis_);
#endif
  return true;
}

uint32_t BackendClient::getEstimatedEpoch() const
{
  if (syncEpoch_ == 0)
    return 0; // No sync yet.

  uint32_t now = millis();
  uint32_t elapsedMs;
  if (now >= syncMillis_)
    elapsedMs = now - syncMillis_;
  else
    elapsedMs = (0xFFFFFFFFUL - syncMillis_) + now + 1UL; // millis() overflow (~49 days)

  return syncEpoch_ + (elapsedMs / 1000UL);
}
