/**
 * A7670E SIMCom Module Test Firmware
 *
 * ESP32-only firmware to test the A7670E LTE modem:
 * - AT communication (testAT)
 * - IMEI / ICCID
 * - Network registration and signal (CSQ, operator)
 * - Optional test SMS
 *
 * Wiring: A7670E on UART1 — RX=34, TX=32 (see include/config.h).
 * Build: pio run
 * Upload: pio run -t upload
 * Monitor: pio device monitor
 */

#include <Arduino.h>
#include "config.h"
#include <TinyGsmClient.h>
#include <string.h>

#define SerialAT Serial1

static TinyGsm* modem = nullptr;
static int s_rxPin = SIM_RX_PIN;
static int s_txPin = SIM_TX_PIN;
static int s_baud = SIM_BAUD;

// Try to get AT response; flush and retry up to maxRetries times.
static bool tryTestAT(int maxRetries, unsigned long timeoutMs) {
  for (int i = 0; i < maxRetries; i++) {
    SerialAT.flush();
    delay(200);
    if (modem->testAT(timeoutMs))
      return true;
    Serial.printf("   AT retry %d/%d\n", i + 1, maxRetries);
    delay(2000);
  }
  return false;
}

static void printSep() {
  Serial.println("----------------------------------------");
}

static void runAtTest() {
  printSep();
  Serial.println("1. AT test");
  if (tryTestAT(5, 15000L)) {
    Serial.println("   OK: modem responds to AT");
  } else {
    Serial.println("   FAIL: no AT response. Check wiring (RX/TX), baud, power.");
    return;
  }
}

static void runModemInfo() {
  printSep();
  Serial.println("2. Modem info");
  String imei = modem->getIMEI();
  if (imei.length()) {
    Serial.printf("   IMEI: %s\n", imei.c_str());
  } else {
    Serial.println("   IMEI: (not available)");
  }
  String iccid = modem->getSimCCID();
  if (iccid.length()) {
    Serial.printf("   ICCID: %s\n", iccid.c_str());
  } else {
    Serial.println("   ICCID: (no SIM or not ready)");
  }
}

static void runNetworkStatus() {
  printSep();
  Serial.println("3. Network status");
  int csq = modem->getSignalQuality();
  Serial.printf("   CSQ: %d (0-31, 99=unknown)\n", csq);
  String op = modem->getOperator();
  if (op.length()) {
    Serial.printf("   Operator: %s\n", op.c_str());
  } else {
    Serial.println("   Operator: (not registered)");
  }
  bool reg = modem->isNetworkConnected();
  Serial.printf("   Network connected: %s\n", reg ? "yes" : "no");
}

static void runWaitForNetwork() {
  printSep();
  Serial.println("4. Wait for network (up to 90 s)");
  bool ok = modem->waitForNetwork(90000L, true);
  Serial.printf("   Result: %s\n", ok ? "registered" : "timeout / no signal");
}

static void runTestSms() {
  if (ENABLE_TEST_SMS && strlen(TEST_SMS_RECIPIENT) > 0) {
    printSep();
    Serial.println("5. Send test SMS");
    Serial.printf("   To: %s\n", TEST_SMS_RECIPIENT);
    bool ok = modem->sendSMS(String(TEST_SMS_RECIPIENT), String(TEST_SMS_MESSAGE));
    Serial.printf("   Result: %s\n", ok ? "sent" : "failed");
  } else {
    printSep();
    Serial.println("5. Test SMS skipped (set ENABLE_TEST_SMS and TEST_SMS_RECIPIENT in config.h to enable)");
  }
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\nA7670E SIMCom test firmware");
  Serial.println("PoleTransMonitor - modem test only\n");

#if defined(SIM_SWAP_RX_TX) && (SIM_SWAP_RX_TX)
  if (s_rxPin != 34 && s_rxPin != 35 && s_rxPin != 36 && s_rxPin != 39) {
    int t = s_rxPin;
    s_rxPin = s_txPin;
    s_txPin = t;
    Serial.println("(RX/TX swapped)");
  }
#endif

  s_baud = SIM_BAUD;
  Serial.printf("UART: RX=%d TX=%d\n", s_rxPin, s_txPin);
  Serial.printf("Waiting %d ms for modem boot...\n", (int)MODEM_BOOT_MS);
  SerialAT.begin(s_baud, SERIAL_8N1, s_rxPin, s_txPin);
  delay(MODEM_BOOT_MS);

  if (!modem) {
    modem = new TinyGsm(SerialAT);
  }
  modem->init();

  Serial.printf("Trying %d baud...\n", s_baud);
  runAtTest();

#if defined(SIM_TRY_9600_IF_FAIL) && (SIM_TRY_9600_IF_FAIL)
  if (!modem->testAT(2000L) && SIM_BAUD != 9600) {
    Serial.println("Trying 9600 baud...");
    SerialAT.end();
    delay(500);
    SerialAT.begin(9600, SERIAL_8N1, s_rxPin, s_txPin);
    delay(1000);
    s_baud = 9600;
    if (tryTestAT(5, 15000L)) {
      Serial.println("   OK: modem responds at 9600 baud");
    }
  }
#endif

  if (!modem->testAT(2000L)) {
    Serial.println("\nStopping: modem not responding. Check:");
    Serial.println("  - Power (A7670E needs stable 3.3V/4V, peaks ~2A)");
    Serial.println("  - Wiring: ESP32 RX(34) <-> Modem TX, ESP32 TX(32) <-> Modem RX");
    Serial.println("  - Baud in config.h (115200 default, try 9600)");
    return;
  }

  runModemInfo();
  runNetworkStatus();
  runWaitForNetwork();
  runNetworkStatus();
  runTestSms();

  printSep();
  Serial.println("Test sequence done. Loop: re-run AT + CSQ every 30 s.");
  printSep();
}

void loop() {
  if (!modem) return;
  delay(30000);
  Serial.println("\n--- Periodic check ---");
  if (modem->testAT(5000L)) {
    int csq = modem->getSignalQuality();
    Serial.printf("AT OK, CSQ=%d\n", csq);
  } else {
    Serial.println("AT FAIL");
  }
}
