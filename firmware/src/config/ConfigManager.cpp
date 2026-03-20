#include "ConfigManager.h"
#include "config.h"
#include "../fault/ThresholdEvaluator.h"
#include <Preferences.h>
#include <cstring>

static const char* NVS_NAMESPACE = "ptm";
static const char* KEY_URL = "backend_url";
static const char* KEY_ID = "transformer_id";
static const char* KEY_DKEY = "device_api_key";
static const char* KEY_ACTIVE = "is_active";
static const char* KEY_PROF_NV = "prof_nv";
static const char* KEY_PROF_NF = "prof_nf";
static const char* KEY_PROF_RI = "prof_ri";
static const char* KEY_PROF_RVA = "prof_rva";
static const char* KEY_PROF_OK = "prof_ok";

void ConfigManager::load() {
  Preferences prefs;
  if (!prefs.begin(NVS_NAMESPACE, false)) {
    strncpy(backendUrl_, BACKEND_URL, URL_MAX - 1);
    backendUrl_[URL_MAX - 1] = '\0';
    transformerId_ = TRANSFORMER_ID;
    deviceApiKey_[0] = '\0';
    isActive_ = true;
    profileNominalV_ = NOMINAL_VOLTAGE;
    profileNominalF_ = NOMINAL_FREQUENCY;
    profileRatedI_ = RATED_CURRENT;
    profileRatedVa_ = RATED_APPARENT_POWER;
    return;
  }
  String u = prefs.getString(KEY_URL, String(BACKEND_URL));
  strncpy(backendUrl_, u.c_str(), URL_MAX - 1);
  backendUrl_[URL_MAX - 1] = '\0';
  transformerId_ = prefs.getInt(KEY_ID, TRANSFORMER_ID);
  if (transformerId_ <= 0) transformerId_ = TRANSFORMER_ID;

  String dk = prefs.getString(KEY_DKEY, "");
  strncpy(deviceApiKey_, dk.c_str(), DEVICE_KEY_MAX - 1);
  deviceApiKey_[DEVICE_KEY_MAX - 1] = '\0';

  isActive_ = prefs.getBool(KEY_ACTIVE, true);

  if (prefs.getBool(KEY_PROF_OK, false)) {
    profileNominalV_ = prefs.getFloat(KEY_PROF_NV, NOMINAL_VOLTAGE);
    profileNominalF_ = prefs.getFloat(KEY_PROF_NF, NOMINAL_FREQUENCY);
    profileRatedI_ = prefs.getFloat(KEY_PROF_RI, RATED_CURRENT);
    profileRatedVa_ = prefs.getFloat(KEY_PROF_RVA, RATED_APPARENT_POWER);
  } else {
    profileNominalV_ = NOMINAL_VOLTAGE;
    profileNominalF_ = NOMINAL_FREQUENCY;
    profileRatedI_ = RATED_CURRENT;
    profileRatedVa_ = RATED_APPARENT_POWER;
  }
  prefs.end();
}

void ConfigManager::saveProfileToNvs() {
  Preferences prefs;
  if (!prefs.begin(NVS_NAMESPACE, false)) return;
  prefs.putFloat(KEY_PROF_NV, profileNominalV_);
  prefs.putFloat(KEY_PROF_NF, profileNominalF_);
  prefs.putFloat(KEY_PROF_RI, profileRatedI_);
  prefs.putFloat(KEY_PROF_RVA, profileRatedVa_);
  prefs.putBool(KEY_PROF_OK, true);
  prefs.putBool(KEY_ACTIVE, isActive_);
  prefs.end();
}

void ConfigManager::save() {
  Preferences prefs;
  if (!prefs.begin(NVS_NAMESPACE, false)) return;
  prefs.putString(KEY_URL, backendUrl_);
  prefs.putInt(KEY_ID, transformerId_);
  prefs.putString(KEY_DKEY, deviceApiKey_);
  prefs.putBool(KEY_ACTIVE, isActive_);
  prefs.putFloat(KEY_PROF_NV, profileNominalV_);
  prefs.putFloat(KEY_PROF_NF, profileNominalF_);
  prefs.putFloat(KEY_PROF_RI, profileRatedI_);
  prefs.putFloat(KEY_PROF_RVA, profileRatedVa_);
  prefs.putBool(KEY_PROF_OK, true);
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

void ConfigManager::setDeviceApiKey(const char* key) {
  if (!key) {
    deviceApiKey_[0] = '\0';
    return;
  }
  strncpy(deviceApiKey_, key, DEVICE_KEY_MAX - 1);
  deviceApiKey_[DEVICE_KEY_MAX - 1] = '\0';
}

void ConfigManager::setActive(bool active) {
  isActive_ = active;
  // Persist so the device stays deactivated even if it temporarily loses WiFi.
  save();
}

void ConfigManager::setCachedProfile(float nominalVoltage,
                                   float nominalFreq,
                                   float ratedCurrent,
                                   float ratedApparentPowerVa) {
  if (nominalVoltage > 0.0f) profileNominalV_ = nominalVoltage;
  if (nominalFreq > 0.0f) profileNominalF_ = nominalFreq;
  if (ratedCurrent > 0.0f) profileRatedI_ = ratedCurrent;
  if (ratedApparentPowerVa > 0.0f) profileRatedVa_ = ratedApparentPowerVa;
  saveProfileToNvs();
}

void ConfigManager::fillEvalParams(EvalParams& out) const {
  out.nominalVoltage = profileNominalV_;
  out.nominalFreq = profileNominalF_;
  out.ratedCurrent = profileRatedI_;
  out.ratedApparentPower = profileRatedVa_;
}
