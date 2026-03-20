#ifndef BACKEND_CLIENT_H
#define BACKEND_CLIENT_H

class ConfigManager;

struct ReadingPayload {
  int transformerId;
  float voltage;
  float current;
  float apparentPower;
  float realPower;   // Real power in watts (live wattage from PZEM)
  float powerFactor;
  float frequency;
  float oilTemp;
  float energyKwh;  // Cumulative energy in kWh (PZEM since last reset)
  const char* condition;
};

class BackendClient {
 public:
  void begin(const char* baseUrl, int transformerId);
  bool postReading(const ReadingPayload& payload);
  // Returns HTTP status code; -1 if not attempted (WiFi down)
  int postReadingWithStatus(const ReadingPayload& payload);

  /**
   * GET /api/transformers/<id>/device_config/ with X-Device-Key.
   * On 200, updates ConfigManager cached profile (NVS) and in-RAM fields.
   */
  bool fetchDeviceConfig(const char* deviceKey, ConfigManager& cm);

 private:
  char baseUrl_[128];
  int transformerId_ = 0;
};

#endif
