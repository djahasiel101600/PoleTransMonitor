#ifndef SIM7600_MANAGER_H
#define SIM7600_MANAGER_H

class Sim7600Manager {
 public:
  // pwrPin: GPIO for A7670E PWE_EN (pulse LOW 1.5s then HIGH to power on). Use 0 or -1 to skip.
  void begin(int rxPin = 34, int txPin = 32, int baud = 9600, int pwrPin = -1);
  bool sendSms(const char* recipient, const char* message);
  bool isReady();

 private:
  bool initialized_ = false;
  int rxPin_;
  int txPin_;
  int baud_;
};

#endif
