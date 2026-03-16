#include "BackendClient.h"
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
