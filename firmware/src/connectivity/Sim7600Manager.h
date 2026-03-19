#ifndef SIM7600_MANAGER_H
#define SIM7600_MANAGER_H

#include <cstddef>

class Sim7600Manager {
 public:
  void begin(int rxPin = 34, int txPin = 32, int baud = 9600, int pwrPin = 0);
  bool sendSms(const char* recipient, const char* message);
  bool isReady();

  /** Enable new-SMS indication so incoming SMS are pushed to UART (+CMT: ...). Call once after begin(). */
  void enableSmsIndication();
  /**
   * Poll for an incoming SMS. Call every loop. Returns true when a full SMS was received;
   * sender and body are filled (use senderLen/bodyLen ~32 and ~128). Body is trimmed.
   */
  bool pollIncomingSms(char* sender, size_t senderLen, char* body, size_t bodyLen);

 private:
  bool initialized_ = false;
  int rxPin_;
  int txPin_;
  int baud_;
};

#endif
