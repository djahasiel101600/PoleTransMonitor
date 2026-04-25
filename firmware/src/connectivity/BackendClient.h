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
   * Post a reading with an explicit ISO-8601 UTC timestamp (used when replaying
   * offline-buffered readings).  Returns the HTTP status code.
   */
  int postReadingWithTimestamp(const ReadingPayload &payload, uint32_t epochSec);

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

  /**
   * GET /api/health/ and record the server's Unix epoch so offline readings can
   * be stamped with an estimated wall-clock time.
   * Persists syncEpoch_ + syncMillis_ to NVS so estimates survive a reboot.
   * Returns true on success.
   */
  bool syncServerTime();

  /**
   * Estimate current Unix epoch based on the last successful syncServerTime().
   * Returns 0 when no sync has been performed yet.
   */
  uint32_t getEstimatedEpoch() const;

  /** Returns the transformer ID this client is configured for. */
  int getTransformerId() const { return transformerId_; }

private:
  char baseUrl_[128];
  int transformerId_ = 1;

  // Time sync state (set by syncServerTime, persisted to NVS).
  uint32_t syncEpoch_ = 0;  // Server Unix epoch at last sync.
  uint32_t syncMillis_ = 0; // millis() value at last sync.
};

#endif
