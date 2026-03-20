#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <cstddef>

struct EvalParams;

/**
 * NVS: backend URL, transformer ID, device API key (from dashboard), and cached
 * nameplate profile synced from GET /api/transformers/<id>/device_config/.
 */
class ConfigManager {
 public:
  static const size_t URL_MAX = 128;
  static const size_t DEVICE_KEY_MAX = 96;

  void load();
  void save();

  const char* getBackendUrl() const { return backendUrl_; }
  int getTransformerId() const { return transformerId_; }
  const char* getDeviceApiKey() const { return deviceApiKey_; }
  bool isActive() const { return isActive_; }

  void setBackendUrl(const char* url);
  void setTransformerId(int id);
  void setDeviceApiKey(const char* key);
  void setActive(bool active);

  /** After successful HTTP device_config fetch — persists profile to NVS. */
  void setCachedProfile(float nominalVoltage,
                        float nominalFreq,
                        float ratedCurrent,
                        float ratedApparentPowerVa);

  void fillEvalParams(EvalParams& out) const;

 private:
  void saveProfileToNvs();

  char backendUrl_[URL_MAX];
  char deviceApiKey_[DEVICE_KEY_MAX];
  int transformerId_ = 1;
  bool isActive_ = true;

  float profileNominalV_ = 230.0f;
  float profileNominalF_ = 60.0f;
  float profileRatedI_ = 68.0f;
  float profileRatedVa_ = 15000.0f;
};

#endif
