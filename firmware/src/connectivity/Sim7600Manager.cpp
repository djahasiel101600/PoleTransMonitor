#include "Sim7600Manager.h"
#include "config.h"
#include <TinyGsmClient.h>
#include <Arduino.h>
#include <cstring>

// Use Serial2 to match working firmware_a7670e_test (test uses HardwareSerial(2))
#define SerialAT Serial2

static TinyGsm* modem = nullptr;

// Match firmware_a7670e_test: power-on pulse then wait and drain boot output
static void modemPowerOn(int pwrPin) {
  pinMode(pwrPin, OUTPUT);
  digitalWrite(pwrPin, HIGH);
  delay(100);
  digitalWrite(pwrPin, LOW);
  delay(1500);
  digitalWrite(pwrPin, HIGH);
#if DEBUG_SERIAL
  Serial.println("[DEBUG SIM] PWE_EN pulse done, waiting for boot...");
#endif
  delay(2000);
  uint32_t bootEnd = millis() + 6000;
  while (millis() < bootEnd) {
    while (SerialAT.available()) SerialAT.read();
    delay(30);
  }
  while (SerialAT.available()) SerialAT.read();
  delay(50);
}

void Sim7600Manager::begin(int rxPin, int txPin, int baud, int pwrPin) {
  rxPin_ = rxPin;
  txPin_ = txPin;
#if defined(SIM_SWAP_RX_TX) && (SIM_SWAP_RX_TX)
  if (rxPin != 34 && rxPin != 35 && rxPin != 36 && rxPin != 39) {
    rxPin_ = txPin;
    txPin_ = rxPin;
  }
#endif
  baud_ = baud;

#if DEBUG_SERIAL
  Serial.printf("[DEBUG SIM] UART RX=%d TX=%d baud=%d\n", rxPin_, txPin_, baud_);
#endif

  // Same order as working test: open UART first, then power on modem
  SerialAT.begin(baud_, SERIAL_8N1, rxPin_, txPin_);
  delay(500);

  if (pwrPin > 0) {
    modemPowerOn(pwrPin);
  } else {
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] No PWR pin, waiting 8s for modem...");
#endif
    delay(8000);
    while (SerialAT.available()) SerialAT.read();
  }

  if (!modem) {
    modem = new TinyGsm(SerialAT);
  }
  modem->init();
  initialized_ = false;

  // Try AT at current baud (same as test: 5 retries, 3s timeout)
  for (int retry = 0; retry < 5; retry++) {
    if (modem->testAT(3000L)) {
      initialized_ = true;
#if DEBUG_SERIAL
      Serial.printf("[DEBUG SIM] AT OK at %d baud\n", (int)baud_);
#endif
      break;
    }
#if DEBUG_SERIAL
    Serial.printf("[DEBUG SIM] testAT retry %d/5\n", retry + 1);
#endif
    delay(400);
    while (SerialAT.available()) SerialAT.read();
  }

  // If no AT at 9600, try 115200 (like working test)
  if (!initialized_ && baud_ == 9600) {
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] No AT at 9600, trying 115200...");
#endif
    SerialAT.end();
    delay(200);
    SerialAT.begin(115200, SERIAL_8N1, rxPin_, txPin_);
    baud_ = 115200;
    delay(300);
    while (SerialAT.available()) SerialAT.read();
    modem->init();
    for (int retry = 0; retry < 5; retry++) {
      if (modem->testAT(3000L)) {
        initialized_ = true;
#if DEBUG_SERIAL
        Serial.println("[DEBUG SIM] AT OK at 115200");
#endif
        break;
      }
      delay(400);
      while (SerialAT.available()) SerialAT.read();
    }
  }

#if DEBUG_SERIAL
  Serial.printf("[DEBUG SIM] init done, testAT=%s\n", initialized_ ? "OK" : "FAIL");
#endif

  if (initialized_) {
#if DEBUG_SERIAL
    Serial.println("[DEBUG SIM] waiting for network...");
#endif
    bool reg = modem->waitForNetwork(90000L, true);
#if DEBUG_SERIAL
    Serial.printf("[DEBUG SIM] waitForNetwork=%s\n", reg ? "OK" : "FAIL");
#endif
    initialized_ = reg;
  }
}

bool Sim7600Manager::isReady() {
  return initialized_ && modem && modem->testAT();
}

bool Sim7600Manager::sendSms(const char* recipient, const char* message) {
  if (!initialized_ || !modem) return false;
#if DEBUG_SERIAL
  Serial.printf("[DEBUG SIM] sendSms to %s\n", recipient);
#endif
  bool ok = modem->sendSMS(String(recipient), String(message));
#if DEBUG_SERIAL
  Serial.printf("[DEBUG SIM] sendSms=%s\n", ok ? "OK" : "FAIL");
#endif
  return ok;
}

void Sim7600Manager::enableSmsIndication() {
  if (!initialized_) return;
  while (SerialAT.available()) SerialAT.read();
  // Text mode required for +CMT to deliver message body as text
  SerialAT.println("AT+CMGF=1");
  delay(300);
  while (SerialAT.available()) SerialAT.read();
  SerialAT.println("AT+CNMI=1,2,0,0,0");
  delay(100);
  uint32_t deadline = millis() + 2000;
  while (millis() < deadline) {
    while (SerialAT.available()) SerialAT.read();
    delay(10);
  }
#if DEBUG_SERIAL
  Serial.println("[DEBUG SIM] CMGF=1, CNMI=1,2,0,0,0 (new SMS forwarded to TE)");
#endif
}

// Parse sender from +CMT: "+number","","date" — first quoted string.
static void parseCmtSender(const char* line, char* out, size_t outLen) {
  out[0] = '\0';
  const char* p = strchr(line, '"');
  if (!p) return;
  p++;
  const char* q = strchr(p, '"');
  if (!q || (size_t)(q - p) >= outLen) return;
  memcpy(out, p, (size_t)(q - p));
  out[q - p] = '\0';
}

// Trim leading/trailing space from s in place; return s.
static char* trimInPlace(char* s) {
  while (*s == ' ' || *s == '\t' || *s == '\r' || *s == '\n') s++;
  char* t = s + strcspn(s, "\r\n");
  while (t > s && (t[-1] == ' ' || t[-1] == '\t' || t[-1] == '\r' || t[-1] == '\n')) t--;
  *t = '\0';
  return s;
}

bool Sim7600Manager::pollIncomingSms(char* sender, size_t senderLen, char* body, size_t bodyLen) {
  if (!initialized_ || senderLen == 0 || bodyLen == 0) return false;
  sender[0] = '\0';
  body[0] = '\0';

  static char lineBuf[256];
  static size_t lineLen = 0;
  static bool nextLineIsBody = false;
  static char savedSender[32];  // keep sender until we have the body line

  while (SerialAT.available()) {
    char c = (char)SerialAT.read();
    if (c == '\r' || c == '\n') {
      if (lineLen > 0) {
        lineBuf[lineLen] = '\0';
        if (nextLineIsBody) {
          nextLineIsBody = false;
          strncpy(sender, savedSender, senderLen - 1);
          sender[senderLen - 1] = '\0';
          strncpy(body, trimInPlace(lineBuf), bodyLen - 1);
          body[bodyLen - 1] = '\0';
          lineLen = 0;
          return true;
        }
        if (strncmp(lineBuf, "+CMT:", 5) == 0) {
          parseCmtSender(lineBuf, savedSender, sizeof(savedSender));
          nextLineIsBody = true;
        }
        lineLen = 0;
      }
    } else if (c >= 32 || c == '\t') {
      if (lineLen < sizeof(lineBuf) - 1) lineBuf[lineLen++] = c;
      else lineLen = 0;
    }
  }
  return false;
}
