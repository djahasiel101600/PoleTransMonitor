#include "WiFiManager.h"
#include <WiFi.h>

void WiFiManager::begin(const char* ssid, const char* password) {
  ssid_ = ssid;
  password_ = password;
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
}

bool WiFiManager::isConnected() {
  return WiFi.status() == WL_CONNECTED;
}

void WiFiManager::loop() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastReconnect_ >= RECONNECT_INTERVAL_MS) {
      lastReconnect_ = now;
      WiFi.disconnect();
      WiFi.begin(ssid_, password_);
    }
  }
}
