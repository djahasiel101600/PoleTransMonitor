#include "Sim7600Manager.h"
#include "config.h"
#include <TinyGsmClient.h>
#include <Arduino.h>

#define SerialAT Serial1

static TinyGsm* modem = nullptr;

void Sim7600Manager::begin(int rxPin, int txPin, int baud) {
  rxPin_ = rxPin;
  txPin_ = txPin;
  // ESP32: GPIO 34,35,36,39 are input-only - cannot be TX. Ignore swap if it would put TX on those.
#if defined(SIM_SWAP_RX_TX) && (SIM_SWAP_RX_TX)
  if (rxPin != 34 && rxPin != 35 && rxPin != 36 && rxPin != 39) {
    rxPin_ = txPin;
    txPin_ = rxPin;
  }
#if DEBUG_SERIAL
  else {
    Serial.println("[DEBUG SIM] swap ignored: ESP32 GPIO 34/35/36/39 are input-only (cannot be TX)");
  }
#endif
#endif
  baud_ = baud;
#if DEBUG_SERIAL
  Serial.printf("[DEBUG SIM] init RX=%d TX=%d baud=%d%s\n",
                rxPin_, txPin_, baud,
#if defined(SIM_SWAP_RX_TX) && (SIM_SWAP_RX_TX)
                " (swapped)"
#else
                ""
#endif
  );
#endif
  SerialAT.begin(baud, SERIAL_8N1, rxPin_, txPin_);
#if DEBUG_SERIAL
  Serial.println("[DEBUG SIM] waiting 10s for modem boot...");
#endif
  delay(10000);  // SIM7600 can take 5–15s to boot; was 2s
  if (!modem) {
    modem = new TinyGsm(SerialAT);
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] TinyGsm instance created");
#endif
  }
  modem->init();
  initialized_ = false;
  for (int retry = 0; retry < 5; retry++) {
    if (modem->testAT(15000L)) {
      initialized_ = true;
      break;
    }
#if DEBUG_SERIAL
    Serial.printf("[DEBUG SIM] testAT retry %d/5\n", retry + 1);
#endif
    delay(2000);
  }
#if DEBUG_SERIAL
  Serial.printf("[DEBUG SIM7600] init done, testAT=%s\n", initialized_ ? "OK" : "FAIL");
#endif
  if (initialized_) {
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] waiting for network registration...");
#endif
    bool reg = modem->waitForNetwork(90000L, true);
#if DEBUG_SERIAL
    Serial.printf("[DEBUG SIM7600] waitForNetwork=%s\n", reg ? "OK" : "FAIL (no signal or timeout)");
#endif
    initialized_ = reg;
  }
}

bool Sim7600Manager::isReady() {
  bool ready = initialized_ && modem && modem->testAT();
#if DEBUG_SERIAL
  static bool lastReady = false;
  if (ready != lastReady) {
    Serial.printf("[DEBUG SIM] isReady changed: %s -> %s\n",
                  lastReady ? "true" : "false", ready ? "true" : "false");
    lastReady = ready;
  }
#endif
  return ready;
}

bool Sim7600Manager::sendSms(const char* recipient, const char* message) {
  if (!initialized_ || !modem) {
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] sendSms skipped: modem not initialized");
#endif
    return false;
  }
#if DEBUG_SERIAL
  Serial.printf("[DEBUG SIM] sendSms to %s: %s\n", recipient, message);
#endif
  bool ok = modem->sendSMS(String(recipient), String(message));
#if DEBUG_SERIAL
  Serial.printf("[DEBUG SIM] sendSms result: %s\n", ok ? "OK" : "FAIL");
#endif
  return ok;
}
