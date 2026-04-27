#include "AlertManager.h"
#include <Arduino.h>
#include <string.h>

bool AlertManager::shouldSendSms(const char* condition) {
  if (!condition || strcmp(condition, "normal") == 0) return false;
  unsigned long now = millis();
  if (now - lastSent_ < debounceMs_) return false;
  if (strcmp(condition, lastCondition_) == 0) return false;
  return true;
}

void AlertManager::markSent(const char* condition) {
  lastSent_ = millis();
  strncpy(lastCondition_, condition ? condition : "", sizeof(lastCondition_) - 1);
  lastCondition_[sizeof(lastCondition_) - 1] = '\0';
}
