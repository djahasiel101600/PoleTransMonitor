#ifndef SIM7600_MANAGER_H
#define SIM7600_MANAGER_H

class Sim7600Manager {
 public:
  void begin(int rxPin = 34, int txPin = 32, int baud = 115200);
  bool sendSms(const char* recipient, const char* message);
  bool isReady();

 private:
  bool initialized_ = false;
  int rxPin_;
  int txPin_;
  int baud_;
};

#endif
