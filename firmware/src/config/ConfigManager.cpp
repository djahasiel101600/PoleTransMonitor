#include "ConfigManager.h"
#include "config.h"
#include <Preferences.h>
#include <cstring>

static const char* NVS_NAMESPACE = "ptm";
static const char* KEY_URL = "backend_url";
static const char* KEY_ID = "transformer_id";

void ConfigManager::load() {
  Preferences prefs;
  // Use read-write so namespace is created on first boot (avoids NVS NOT_FOUND error)
  if (!prefs.begin(NVS_NAMESPACE, false)) {
    strncpy(backendUrl_, BACKEND_URL, URL_MAX - 1);
    backendUrl_[URL_MAX - 1] = '\0';
    transformerId_ = TRANSFORMER_ID;
    return;
  }
  String u = prefs.getString(KEY_URL, String(BACKEND_URL));
  strncpy(backendUrl_, u.c_str(), URL_MAX - 1);
  backendUrl_[URL_MAX - 1] = '\0';
  transformerId_ = prefs.getInt(KEY_ID, TRANSFORMER_ID);
  if (transformerId_ <= 0) transformerId_ = TRANSFORMER_ID;
  prefs.end();
}

void ConfigManager::save() {
  Preferences prefs;
  if (!prefs.begin(NVS_NAMESPACE, false)) return;
  prefs.putString(KEY_URL, backendUrl_);
  prefs.putInt(KEY_ID, transformerId_);
  prefs.end();
}

void ConfigManager::setBackendUrl(const char* url) {
  if (!url) return;
  strncpy(backendUrl_, url, URL_MAX - 1);
  backendUrl_[URL_MAX - 1] = '\0';
}

void ConfigManager::setTransformerId(int id) {
  if (id > 0) transformerId_ = id;
}
