#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

class WiFiManager {
 public:
  void begin(const char* ssid, const char* password);
  bool isConnected();
  void loop();

 private:
  const char* ssid_ = nullptr;
  const char* password_ = nullptr;
  unsigned long lastReconnect_ = 0;
  static const unsigned long RECONNECT_INTERVAL_MS = 10000;
};

#endif
