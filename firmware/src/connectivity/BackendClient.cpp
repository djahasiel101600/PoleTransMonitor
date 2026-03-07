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
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  char url[192];
  snprintf(url, sizeof(url), "%s/api/readings/", baseUrl_);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<384> doc;
  doc["transformer_id"] = payload.transformerId;
  doc["voltage"] = payload.voltage;
  doc["current"] = payload.current;
  doc["apparent_power"] = payload.apparentPower;
  doc["power_factor"] = payload.powerFactor;
  doc["frequency"] = payload.frequency;
  doc["oil_temp"] = payload.oilTemp;
  doc["condition"] = payload.condition;

  char body[384];
  size_t len = serializeJson(doc, body);

  int code = http.POST((uint8_t*)body, len);
  http.end();
  return code >= 200 && code < 300;
}
