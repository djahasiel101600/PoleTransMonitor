#include "Sim7600Manager.h"
#include "config.h"
#include <TinyGsmClient.h>
#include <Arduino.h>

#define SerialAT Serial1

static TinyGsm* modem = nullptr;

void Sim7600Manager::begin(int rxPin, int txPin, int baud, int pwrPin) {
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
  SerialAT.begin(baud_, SERIAL_8N1, rxPin_, txPin_);
  delay(500);

  // A7670E power-on: PWE_EN LOW 1.5s then HIGH (same as working test sketch)
  if (pwrPin > 0) {
    pinMode(pwrPin, OUTPUT);
    digitalWrite(pwrPin, HIGH);
    delay(100);
    digitalWrite(pwrPin, LOW);
    delay(1500);
    digitalWrite(pwrPin, HIGH);
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] modem power-on pulse, waiting for boot...");
#endif
    delay(2000);
    // Flush boot output for 8s and echo any bytes (data = modem talking, none = wiring/power)
    uint32_t bootEnd = millis() + 8000;
    int bootBytes = 0;
    while (millis() < bootEnd) {
      while (SerialAT.available()) {
        int c = SerialAT.read();
        bootBytes++;
#if DEBUG_SERIAL
        if (c >= 32 && c < 127) Serial.write((char)c);
        else Serial.printf("\\x%02X", c & 0xFF);
#endif
      }
      delay(30);
    }
    while (SerialAT.available()) { SerialAT.read(); bootBytes++; }
#if DEBUG_SERIAL
    Serial.printf("\n[DEBUG SIM] boot window done, received %d bytes from modem\n", bootBytes);
#endif
    delay(50);
  } else {
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] no PWR pin, waiting 3s for modem...");
#endif
    delay(3000);
  }

  if (!modem) {
    modem = new TinyGsm(SerialAT);
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] TinyGsm instance created");
#endif
  }
  modem->init();
  initialized_ = false;

  // Many A7670E default to 115200; try it first when config is 9600
  if (baud_ == 9600) {
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] trying 115200 first (A7670E default)...");
#endif
    SerialAT.end();
    delay(200);
    SerialAT.begin(115200, SERIAL_8N1, rxPin_, txPin_);
    delay(300);
    modem->init();
    for (int r = 0; r < 3; r++) {
      if (modem->testAT(8000L)) {
        initialized_ = true;
        baud_ = 115200;
#if DEBUG_SERIAL
        Serial.println("[DEBUG SIM] AT OK at 115200");
#endif
        break;
      }
      delay(1000);
    }
    if (!initialized_) {
      SerialAT.end();
      delay(200);
      SerialAT.begin(9600, SERIAL_8N1, rxPin_, txPin_);
      baud_ = 9600;
      delay(300);
      modem->init();
    }
  }

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

  // If no AT at 9600, try 115200 (like the working test sketch)
  if (!initialized_ && baud_ == 9600) {
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] No AT at 9600, trying 115200...");
#endif
    SerialAT.end();
    delay(200);
    SerialAT.begin(115200, SERIAL_8N1, rxPin_, txPin_);
    baud_ = 115200;
    delay(300);
    modem->init();
    for (int retry = 0; retry < 3; retry++) {
      if (modem->testAT(10000L)) {
        initialized_ = true;
#if DEBUG_SERIAL
        Serial.println("[DEBUG SIM] AT OK at 115200");
#endif
        break;
      }
      delay(1000);
    }
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
