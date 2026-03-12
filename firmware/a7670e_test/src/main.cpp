/**
 * SIMCom A7670E – standalone UART test
 *
 * 1. Start UART (so it's ready when modem boots), then power on modem (PWE_EN).
 * 2. Try bauds 9600, 115200, 57600, 38400: send AT, look for OK.
 * 3. If OK: print SIM status (AT+CPIN?), optionally send one test SMS, then echo modem in loop.
 *
 * WIRING (set below):
 *   Modem TXD  →  ESP32 RX  (MODEM_RX)
 *   Modem RXD  ←  ESP32 TX  (MODEM_TX)
 *   Modem PWE_EN  ←  GPIO MODEM_PWR  (LOW 1.5s then HIGH to power on)
 *
 * Build/upload from firmware/a7670e_test, then: pio device monitor -b 115200
 */

#include <Arduino.h>
#include <HardwareSerial.h>

// ============ CONFIG (change to match your wiring) ============
#define MODEM_RX  16   // ESP32 RX  ← Modem TXD   (try 17, 25, 34 if needed)
#define MODEM_TX  17   // ESP32 TX  → Modem RXD   (try 16, 26, 32 if needed)
#define MODEM_PWR 4    // PWE_EN (0 = not used)

// Set to 1 to send one test SMS after AT OK (and set number below)
#define SEND_TEST_SMS  0
#define TEST_SMS_NUMBER "+639171234567"
// ==============================================================

#define AT_TIMEOUT_MS   3000
#define BOOT_DRAIN_MS   8000

HardwareSerial ModemSerial(2);
static unsigned long g_workingBaud = 0;

// Drain modem output for timeoutMs; print as hex; return byte count
static int drainAndPrintHex(uint32_t timeoutMs) {
  int n = 0;
  uint32_t dead = millis() + timeoutMs;
  while (millis() < dead) {
    while (ModemSerial.available()) {
      uint8_t c = (uint8_t)ModemSerial.read();
      n++;
      Serial.printf("%02X ", c);
      if (n % 20 == 0) Serial.println();
    }
    delay(5);
  }
  if (n > 0 && n % 20 != 0) Serial.println();
  return n;
}

// Send "AT", collect response for timeoutMs; return true if "OK" found
static bool sendAtAndWaitOk(unsigned long baud, uint32_t timeoutMs) {
  ModemSerial.end();
  delay(150);
  ModemSerial.begin(baud, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(100);
  while (ModemSerial.available()) ModemSerial.read();

  ModemSerial.println("AT");
  delay(150);

  char buf[128];
  int len = 0;
  uint32_t dead = millis() + timeoutMs;
  while (millis() < dead && len < (int)sizeof(buf) - 1) {
    while (ModemSerial.available() && len < (int)sizeof(buf) - 1) {
      char c = (char)ModemSerial.read();
      buf[len++] = c;
      buf[len] = '\0';
      if (strstr(buf, "OK")) return true;
      if (strstr(buf, "AT\r\r\n")) { /* echo, keep going */ }
    }
    delay(5);
  }
  return false;
}

// Print response as text (printable) or hex for debugging
static void printResponse(uint32_t timeoutMs) {
  int n = 0;
  uint32_t dead = millis() + timeoutMs;
  Serial.print("  response: ");
  while (millis() < dead) {
    while (ModemSerial.available()) {
      int c = ModemSerial.read() & 0xFF;
      n++;
      if (c >= 32 && c < 127) Serial.write((char)c);
      else Serial.printf("[%02X]", c);
    }
    delay(5);
  }
  if (n == 0) Serial.print("(none)");
  Serial.println();
}

// Send AT command, wait for OK, print response
static bool atCommand(const char* cmd, uint32_t timeoutMs) {
  while (ModemSerial.available()) ModemSerial.read();
  ModemSerial.println(cmd);
  delay(100);
  char buf[96];
  int len = 0;
  uint32_t dead = millis() + timeoutMs;
  while (millis() < dead && len < (int)sizeof(buf) - 1) {
    while (ModemSerial.available() && len < (int)sizeof(buf) - 1) {
      char c = (char)ModemSerial.read();
      buf[len++] = c;
      buf[len] = '\0';
      if (strstr(buf, "OK")) {
        Serial.print("  -> ");
        Serial.println(cmd);
        return true;
      }
    }
    delay(5);
  }
  return false;
}

// Send SMS in text mode; return true on success
static bool sendSmsSimple(const char* number, const char* text) {
  if (!atCommand("AT+CMGF=1", 2000)) return false;
  while (ModemSerial.available()) ModemSerial.read();
  ModemSerial.print("AT+CMGS=\"");
  ModemSerial.print(number);
  ModemSerial.println("\"");
  delay(500);
  int last = -1;
  uint32_t dead = millis() + 5000;
  while (millis() < dead) {
    if (ModemSerial.available()) {
      last = ModemSerial.read();
      if (last == '>') break;
    }
    delay(5);
  }
  if (last != '>') { Serial.println("  SMS: no >"); return false; }
  ModemSerial.println(text);
  delay(100);
  ModemSerial.write(0x1A);
  delay(300);
  dead = millis() + 20000;
  char buf[8];
  int bi = 0;
  while (millis() < dead) {
    while (ModemSerial.available()) {
      char c = (char)ModemSerial.read();
      Serial.write(c >= 32 && c < 127 ? c : '.');
      if (bi < (int)sizeof(buf) - 1) { buf[bi++] = c; buf[bi] = '\0'; }
      if (strstr(buf, "OK")) { Serial.println(); return true; }
    }
    delay(10);
  }
  Serial.println();
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println("\n========== SIMCom A7670E test ==========\n");

  // UART on before power so we don't miss boot
  Serial.println("[1] Opening UART at 9600 (RX=" + String(MODEM_RX) + " TX=" + String(MODEM_TX) + ")");
  ModemSerial.begin(9600, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(200);

  if (MODEM_PWR > 0) {
    Serial.println("[2] Power on (PWE_EN pulse 1.5s LOW)...");
    pinMode(MODEM_PWR, OUTPUT);
    digitalWrite(MODEM_PWR, HIGH);
    delay(100);
    digitalWrite(MODEM_PWR, LOW);
    delay(1500);
    digitalWrite(MODEM_PWR, HIGH);
    delay(2500);
    Serial.println("     Waiting for boot output (8s)...");
    int n = drainAndPrintHex(BOOT_DRAIN_MS);
    Serial.printf("     (%d bytes)\n\n", n);
  } else {
    Serial.println("[2] No PWR pin; waiting 5s...");
    delay(5000);
    while (ModemSerial.available()) ModemSerial.read();
  }

  // Try each baud until we get OK
  const unsigned long bauds[] = { 9600, 115200, 57600, 38400 };
  for (int i = 0; i < 4; i++) {
    Serial.printf("[3] Trying %lu baud... ", bauds[i]);
    if (sendAtAndWaitOk(bauds[i], AT_TIMEOUT_MS)) {
      g_workingBaud = bauds[i];
      Serial.printf("OK at %lu baud.\n\n", g_workingBaud);
      break;
    }
    printResponse(500);
    Serial.println();
  }

  if (g_workingBaud == 0) {
    Serial.println("No AT OK on any baud. Check wiring: Modem TXD->ESP RX, RXD<-ESP TX, PWE_EN, power.");
    Serial.println("Loop: echoing modem.\n");
    return;
  }

  // SIM status
  Serial.println("[4] SIM status (AT+CPIN?)...");
  while (ModemSerial.available()) ModemSerial.read();
  ModemSerial.println("AT+CPIN?");
  delay(200);
  printResponse(2000);

#if SEND_TEST_SMS
  Serial.println("[5] Sending test SMS to " TEST_SMS_NUMBER "...");
  if (sendSmsSimple(TEST_SMS_NUMBER, "Test from ESP32+A7670E")) {
    Serial.println("     OK.");
  } else {
    Serial.println("     Failed (check signal/number).");
  }
#else
  Serial.println("[5] Skipping SMS (set SEND_TEST_SMS 1 and TEST_SMS_NUMBER in code to enable).");
#endif

  Serial.println("\nDone. Loop: echoing modem (reply to see incoming).\n");
}

void loop() {
  while (ModemSerial.available()) {
    int c = ModemSerial.read();
    if (c >= 32 && c < 127) Serial.write((char)c);
    else Serial.printf("[%02X]", c & 0xFF);
  }
  delay(20);
}
