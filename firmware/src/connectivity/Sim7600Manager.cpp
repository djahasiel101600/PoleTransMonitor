#include "Sim7600Manager.h"
#include <TinyGsmClient.h>
#include <Arduino.h>

#define SerialAT Serial1

static TinyGsm* modem = nullptr;

void Sim7600Manager::begin(int rxPin, int txPin, int baud) {
  rxPin_ = rxPin;
  txPin_ = txPin;
  baud_ = baud;
  SerialAT.begin(baud, SERIAL_8N1, rxPin, txPin);
  delay(2000);
  if (!modem) {
    modem = new TinyGsm(SerialAT);
  }
  modem->init();
  initialized_ = modem->testAT();
}

bool Sim7600Manager::isReady() {
  return initialized_ && modem && modem->testAT();
}

bool Sim7600Manager::sendSms(const char* recipient, const char* message) {
  if (!initialized_ || !modem) return false;
  return modem->sendSMS(String(recipient), String(message));
}
