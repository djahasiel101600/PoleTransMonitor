/**
 * A7670E test from the very basic
 *
 * Step 1: Power on (PWE_EN pulse)
 * Step 2: Open UART, wait 8s, print any bytes from modem (raw)
 * Step 3: Send "AT", print response
 * Step 4: If no "OK", try again at 115200
 *
 * Wiring:
 *   A7670E TXD -> ESP32 RX  (MODEM_RX = 25)
 *   A7670E RXD <- ESP32 TX  (MODEM_TX = 26)
 *   A7670E PWE_EN <- GPIO 4 (LOW 1.5s then HIGH)
 */

#include <Arduino.h>
#include <HardwareSerial.h>

#define MODEM_RX  25   // ESP32 RX  <- A7670E TXD
#define MODEM_TX  26   // ESP32 TX  -> A7670E RXD
#define MODEM_PWR 4    // PWE_EN

HardwareSerial ModemSerial(2);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n===== A7670E test (very basic) =====\n");

  // Step 1: Power on
  Serial.println("Step 1: Power on (PWE_EN pulse)...");
  pinMode(MODEM_PWR, OUTPUT);
  digitalWrite(MODEM_PWR, HIGH);
  delay(100);
  digitalWrite(MODEM_PWR, LOW);
  delay(1500);
  digitalWrite(MODEM_PWR, HIGH);
  delay(2000);
  Serial.println("  done.\n");

  // Step 2: UART 9600, wait 8s, show any bytes from modem
  Serial.println("Step 2: UART 9600, listening 8s for modem output...");
  ModemSerial.begin(9600, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(200);
  uint32_t endMs = millis() + 8000;
  int n = 0;
  while (millis() < endMs) {
    while (ModemSerial.available()) {
      int c = ModemSerial.read();
      n++;
      if (c >= 32 && c < 127) Serial.write((char)c);
      else Serial.printf("\\x%02X", c & 0xFF);
    }
    delay(20);
  }
  Serial.printf("\n  Received %d bytes.\n\n", n);

  // Step 3: Send AT, show response
  Serial.println("Step 3: Sending AT...");
  while (ModemSerial.available()) ModemSerial.read();
  ModemSerial.println("AT");
  delay(300);
  endMs = millis() + 3000;
  n = 0;
  while (millis() < endMs) {
    while (ModemSerial.available()) {
      int c = ModemSerial.read();
      n++;
      if (c >= 32 && c < 127) Serial.write((char)c);
      else Serial.printf("\\x%02X", c & 0xFF);
    }
    delay(10);
  }
  Serial.printf("\n  Received %d bytes.\n\n", n);

  if (n == 0) {
    // Step 4: Try 115200
    Serial.println("Step 4: No response at 9600. Trying 115200...");
    ModemSerial.end();
    delay(300);
    ModemSerial.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);
    delay(300);
    while (ModemSerial.available()) ModemSerial.read();
    ModemSerial.println("AT");
    delay(300);
    endMs = millis() + 3000;
    n = 0;
    while (millis() < endMs) {
      while (ModemSerial.available()) {
        int c = ModemSerial.read();
        n++;
        if (c >= 32 && c < 127) Serial.write((char)c);
        else Serial.printf("\\x%02X", c & 0xFF);
      }
      delay(10);
    }
    Serial.printf("\n  Received %d bytes.\n\n", n);
  }

  Serial.println("Done. Loop: echoing modem bytes (if any).");
}

void loop() {
  while (ModemSerial.available()) {
    Serial.write(ModemSerial.read());
  }
  delay(50);
}
