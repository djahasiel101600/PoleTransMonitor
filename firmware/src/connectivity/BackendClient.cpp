#include "BackendClient.h"
#include "../config/ConfigManager.h"
#include "config.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

void BackendClient::begin(const char* baseUrl, int transformerId) {
  strncpy(baseUrl_, baseUrl, sizeof(baseUrl_) - 1);
  baseUrl_[sizeof(baseUrl_) - 1] = '\0';
  transformerId_ = transformerId;
}

bool BackendClient::postReading(const ReadingPayload& payload) {
  int code = postReadingWithStatus(payload);
  return code >= 200 && code < 300;
}

int BackendClient::postReadingWithStatus(const ReadingPayload& payload) {
  if (WiFi.status() != WL_CONNECTED) return -1;

  HTTPClient http;
  char url[192];
  snprintf(url, sizeof(url), "%s/api/readings/", baseUrl_);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<420> doc;
  doc["transformer_id"] = payload.transformerId;
  doc["voltage"] = payload.voltage;
  doc["current"] = payload.current;
  doc["apparent_power"] = payload.apparentPower;
  if (!isnan(payload.realPower)) {
    doc["real_power"] = payload.realPower >= 0.0f ? payload.realPower : 0.0f;
  }
  // Only send power_factor when valid (0–1); NaN is not valid JSON
  if (!isnan(payload.powerFactor) && payload.powerFactor >= 0.0f && payload.powerFactor <= 1.0f) {
    doc["power_factor"] = payload.powerFactor;
  }
  doc["frequency"] = payload.frequency;
  doc["oil_temp"] = payload.oilTemp;
  // Always send energy_kwh when we have a valid number (0 or positive); dashboard shows cumulative kWh
  if (!isnan(payload.energyKwh)) {
    doc["energy_kwh"] = payload.energyKwh >= 0.0f ? payload.energyKwh : 0.0f;
  }
  doc["condition"] = payload.condition;

  char body[420];
  size_t len = serializeJson(doc, body);

  int code = http.POST((uint8_t*)body, len);
  http.end();
  return code;
}

bool BackendClient::fetchDeviceConfig(const char* deviceKey, ConfigManager& cm) {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (!deviceKey || !deviceKey[0]) return false;

  HTTPClient http;
  char url[192];
  snprintf(url, sizeof(url), "%s/api/transformers/%d/device_config/", baseUrl_, transformerId_);
  http.begin(url);
  http.addHeader("X-Device-Key", deviceKey);

  int code = http.GET();
  if (code != 200) {
#if DEBUG_SERIAL
    Serial.printf("[DEBUG] GET device_config HTTP %d\n", code);
#endif
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<768> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
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

  if (nv <= 0.0f || rkva <= 0.0f) {
#if DEBUG_SERIAL
    Serial.println("[DEBUG] device_config missing nominal_voltage or rated_kva");
#endif
    return false;
  }
  if (rva <= 0.0f) {
    rva = rkva * 1000.0f;
  }
  if (nf <= 0.0f) {
    nf = NOMINAL_FREQUENCY;
  }
  if (ri <= 0.0f) {
    ri = RATED_CURRENT;
  }

  // SMS recipients come from backend device_config.
  // Firmware expects a CSV string so it can iterate recipients on alert.
  {
    char csv[ConfigManager::SMS_RECIPIENTS_CSV_MAX];
    csv[0] = '\0';
    size_t off = 0;

    JsonArray rec = doc["sms_recipients"].as<JsonArray>();
    if (!rec.isNull()) {
      for (size_t i = 0; i < rec.size(); i++) {
        const char* p = rec[i].as<const char*>();
        if (!p || !p[0]) continue;
        if (off > 0) {
          off += snprintf(csv + off, sizeof(csv) - off, ",");
        }
        off += snprintf(csv + off, sizeof(csv) - off, "%s", p);
        if (off >= sizeof(csv)) break;
      }
    }

    cm.setSmsRecipientsCsv(csv);
  }

  cm.setActive(isActive);
  cm.setCachedProfile(nv, nf, ri, rva);
  return true;
}
