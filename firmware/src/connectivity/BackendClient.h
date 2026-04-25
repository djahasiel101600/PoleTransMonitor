#ifndef BACKEND_CLIENT_H
#define BACKEND_CLIENT_H

#include <Arduino.h>
#include "../config/ConfigManager.h"

struct ReadingPayload
{
  int transformerId;
  float voltage;
  float current;
  float apparentPower;
  float realPower;
  float powerFactor;
  float frequency;
  float oilTemp;
  float energyKwh;
  const char *condition;
};

class BackendClient
{
public:
  void begin(const char *baseUrl, int transformerId);
  bool postReading(const ReadingPayload &payload);
  int postReadingWithStatus(const ReadingPayload &payload);

  /**
   * Fetch device config (nameplate + flags) from the backend.
   * @param pendingEnergyReset  set to true if backend requests a PZEM energy counter reset.
   * @param pendingOpenPortal   set to true if backend requests opening the config portal.
   */
  bool fetchDeviceConfig(const char *deviceKey, ConfigManager &cm,
                         const char *simPhoneNumber,
                         bool *pendingEnergyReset,
                         bool *pendingOpenPortal = nullptr);

  /** Acknowledge that the PZEM energy counter has been reset. */
  bool ackEnergyReset(const char *deviceKey);

  /** Acknowledge that the config portal has been opened (clears pending_open_portal flag). */
  bool ackPortalOpen(const char *deviceKey);

  /**
   * Fetch the currently active OTA firmware release from the backend.
   * Returns true and fills outVersion / outUrl on success.
   */
  bool fetchCurrentFirmware(char *outVersion, size_t vLen, char *outUrl, size_t uLen);

private:
  char baseUrl_[128];
  int transformerId_ = 1;
};

#endif
