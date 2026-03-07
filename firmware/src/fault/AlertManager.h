#ifndef ALERT_MANAGER_H
#define ALERT_MANAGER_H

class AlertManager {
 public:
  void setDebounceMs(unsigned long ms) { debounceMs_ = ms; }
  bool shouldSendSms(const char* condition);
  void markSent(const char* condition);

 private:
  unsigned long debounceMs_ = 60000;  // 1 min
  unsigned long lastSent_ = 0;
  char lastCondition_[32] = "";
};

#endif
