#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <cstddef>

/**
 * Stores and loads backend URL and transformer ID from NVS (Preferences).
 * Used with the WiFi config portal: when user saves, we persist these values.
 */
class ConfigManager {
 public:
  void load();
  void save();

  const char* getBackendUrl() const { return backendUrl_; }
  int getTransformerId() const { return transformerId_; }

  void setBackendUrl(const char* url);
  void setTransformerId(int id);

 private:
  static const size_t URL_MAX = 128;
  char backendUrl_[URL_MAX];
  int transformerId_ = 1;
};

#endif
