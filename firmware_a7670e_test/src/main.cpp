/**
 * A7670E Standalone Test — learn how the modem works step by step
 *
 * This sketch uses only raw AT commands (no TinyGSM). You'll see exactly
 * what is sent to the modem and what comes back.
 *
 * Flow:
 *   1. Open UART at 9600 (before modem boots).
 *   2. Power on modem (PWE_EN pulse), then capture boot output for 8s.
 *   3. Find working baud: try 9600, 115200, 57600, 38400 with "AT" -> "OK".
 *   4. Run AT+CPIN? (SIM status).
 *   5. Optionally send one test SMS.
 *   5b. If AUTO_REPLY_SMS: set AT+CNMI=1,2,0,0,0 so new SMS are pushed to UART.
 *   6. Loop: echo modem <-> Serial; when +CMT: arrives, auto-reply to sender.
 *
 * Wiring:
 *   A7670E TXD -> ESP32 GPIO 25 (RX)
 *   A7670E RXD <- ESP32 GPIO 26 (TX)
 *   A7670E PWE_EN <- GPIO 4 (LOW 1.5s then HIGH to power on)
 */

 #include <Arduino.h>
 #include <HardwareSerial.h>
 #include <stdio.h>
 
 // ----- Config (match your wiring; or include config.h and use SIM_RX_PIN etc.) -----
 #define MODEM_RX       25   // ESP32 RX  <- A7670E TXD
 #define MODEM_TX       26   // ESP32 TX  -> A7670E RXD
 #define MODEM_PWR      4    // PWE_EN pin (0 = not used, modem always on)
 #define SEND_TEST_SMS  1    // Set to 1 to send one SMS on startup
 #define TEST_SMS_NUMBER "+639922790155"
 // TM (Touch Mobile) / Globe Philippines: same network; APN below works for data. SMS uses same network.
 // Auto-reply: when someone sends an SMS to this SIM, reply automatically (any sender).
 #define AUTO_REPLY_SMS     1        // Set to 1 to enable auto-reply to incoming SMS
 #define AUTO_REPLY_MESSAGE "A7670E here. Got your message."
 // Optional: run a basic internet attach test (uses your APN)
 #define RUN_INTERNET_TEST  0        // Set to 1 to enable
 #define APN                "internet.globe.com.ph"  // TM/Globe PH; some use "internet" only
 
 // UART to modem (ESP32 HardwareSerial 2)
 HardwareSerial ModemSerial(2);
 
 // ----- Helpers: send AT and collect response into a String -----
 static bool sendAtAndCollect(String& response, uint32_t timeoutMs = 3000) {
   response = "";
   while (ModemSerial.available()) ModemSerial.read();
   ModemSerial.println("AT");
   uint32_t deadline = millis() + timeoutMs;
   while (millis() < deadline) {
     while (ModemSerial.available()) {
       char c = (char)ModemSerial.read();
       response += c;
     }
     delay(10);
   }
   return response.indexOf("OK") >= 0;
 }
 
 // Try a baud rate: send AT, return true if we see OK
 static bool tryBaud(long baud) {
   ModemSerial.end();
   delay(200);
   ModemSerial.begin(baud, SERIAL_8N1, MODEM_RX, MODEM_TX);
   delay(400);
   String r;
   bool ok = sendAtAndCollect(r, 4000);
   if (ok) Serial.printf("  -> OK at %ld baud\n", baud);
   return ok;
 }
 
 // Send raw AT line and print response (for learning / debugging)
 static void atCommand(const char* cmd, uint32_t timeoutMs = 3000) {
   while (ModemSerial.available()) ModemSerial.read();
   Serial.printf(">> %s\n", cmd);
   ModemSerial.println(cmd);
   uint32_t deadline = millis() + timeoutMs;
   while (millis() < deadline) {
     while (ModemSerial.available()) {
       Serial.write((char)ModemSerial.read());
     }
     delay(10);
   }
   Serial.println();
 }

 // Send AT command and collect response into String (no print)
 static void atCollect(String& out, const char* cmd, uint32_t timeoutMs = 3000) {
   out = "";
   while (ModemSerial.available()) ModemSerial.read();
   ModemSerial.println(cmd);
   uint32_t deadline = millis() + timeoutMs;
   while (millis() < deadline) {
     while (ModemSerial.available()) out += (char)ModemSerial.read();
     delay(10);
   }
 }

 // Wait for network registration (CREG 0,1 or 1,1). Return true if registered.
 static bool waitForNetwork(uint32_t timeoutMs) {
   uint32_t deadline = millis() + timeoutMs;
   while (millis() < deadline) {
     String r;
     atCollect(r, "AT+CREG?", 2000);
     // +CREG: 0,1 or +CREG: 1,1 = registered home; 0,5 or 1,5 = roaming
     if (r.indexOf(",1") >= 0 || r.indexOf(",5") >= 0) return true;
     delay(2000);
   }
   return false;
 }

 // Send one SMS to the given number (text mode). Echo modem response to Serial.
 static void sendSmsTo(const char* number, const char* body) {
   atCommand("AT+CMGF=1", 2000);
   while (ModemSerial.available()) ModemSerial.read();
   ModemSerial.print("AT+CMGS=\"");
   ModemSerial.print(number);
   ModemSerial.println("\"");
   uint32_t promptEnd = millis() + 5000;
   bool sawPrompt = false;
   while (millis() < promptEnd) {
     while (ModemSerial.available()) {
       char c = (char)ModemSerial.read();
       Serial.write(c);
       if (c == '>') sawPrompt = true;
     }
     if (sawPrompt) break;
     delay(20);
   }
   if (!sawPrompt) { Serial.println("     (no '>' prompt)"); return; }
   ModemSerial.println(body);
   ModemSerial.write(0x1A);
   uint32_t t = millis() + 15000;
   while (millis() < t) {
     while (ModemSerial.available()) Serial.write(ModemSerial.read());
     delay(50);
   }
 }
 
 void setup() {
   Serial.begin(115200);
   delay(1500);
   Serial.println("\n===== A7670E Standalone Test =====\n");
 
   // ----- Step 1: Open UART at 9600 so we're ready before modem boots -----
   Serial.println("[1] Opening UART at 9600...");
   ModemSerial.begin(9600, SERIAL_8N1, MODEM_RX, MODEM_TX);
   delay(200);
   Serial.println("     Done.\n");
 
   // ----- Step 2: Power on modem (PWE_EN), then capture boot output -----
   if (MODEM_PWR > 0) {
     Serial.println("[2] Power on: PWE_EN LOW 1.5s then HIGH...");
     pinMode(MODEM_PWR, OUTPUT);
     digitalWrite(MODEM_PWR, HIGH);
     delay(100);
     digitalWrite(MODEM_PWR, LOW);
     delay(1500);
     digitalWrite(MODEM_PWR, HIGH);
     delay(2000);
     Serial.println("     Listening 8s for modem boot output (raw)...\n");
 
     uint32_t endMs = millis() + 8000;
     int count = 0;
     while (millis() < endMs) {
       while (ModemSerial.available()) {
         int c = ModemSerial.read();
         count++;
         if (c >= 32 && c < 127) Serial.write((char)c);
         else Serial.printf("\\x%02X", c & 0xFF);
       }
       delay(20);
     }
     Serial.printf("\n     Received %d bytes from modem.\n\n", count);
   } else {
     Serial.println("[2] No PWR pin — assuming modem already on. Waiting 3s...");
     delay(3000);
   }
 
   // ----- Step 3: Find working baud (9600, 115200, 57600, 38400) -----
   Serial.println("[3] Finding baud rate (AT -> OK)...");
   const long bauds[] = { 9600, 115200, 57600, 38400 };
   bool found = false;
   for (size_t i = 0; i < sizeof(bauds) / sizeof(bauds[0]); i++) {
     Serial.printf("     Try %ld... ", bauds[i]);
     if (tryBaud(bauds[i])) {
       found = true;
       break;
     }
     Serial.println("no OK");
   }
   if (!found) {
     Serial.println("     No AT OK at any baud. Check wiring and power.\n");
   } else {
     // ----- Step 4: SIM status (AT+CPIN?) -----
     Serial.println("\n[4] SIM status (AT+CPIN?)...");
     atCommand("AT+CPIN?", 4000);
     // +CPIN: READY means SIM is present and unlocked

     // ----- Step 4b: Signal and network (needed for SMS) -----
     Serial.println("[4b] Signal (AT+CSQ) and network (AT+CREG?)...");
     atCommand("AT+CSQ", 2000);   // 0-31 or 99 = unknown; aim for >5 for SMS
     atCommand("AT+CREG?", 2000); // 0,1 or 1,1 = registered
     Serial.println("     Waiting for network registration (up to 60s)...");
     bool registered = waitForNetwork(60000);
     if (registered) Serial.println("     Network registered.");
     else Serial.println("     No registration in time — SMS may get 'Network timeout'.");
 
 #if SEND_TEST_SMS
     // ----- Step 5: Optional test SMS -----
     Serial.println("[5] Sending test SMS...");
     atCommand("AT+CMGF=1", 2000);   // Text mode
     while (ModemSerial.available()) ModemSerial.read();
     ModemSerial.print("AT+CMGS=\"");
     ModemSerial.print(TEST_SMS_NUMBER);
     ModemSerial.println("\"");
     // Wait for ">" prompt (modem ready for message body)
     uint32_t promptEnd = millis() + 5000;
     bool sawPrompt = false;
     while (millis() < promptEnd) {
       while (ModemSerial.available()) {
         char c = (char)ModemSerial.read();
         Serial.write(c);
         if (c == '>') sawPrompt = true;
       }
       if (sawPrompt) break;
       delay(20);
     }
     if (!sawPrompt) Serial.println("     (no '>' prompt, SMS may fail)");
     ModemSerial.println("A7670E test from ESP32");
     ModemSerial.write(0x1A);   // Ctrl+Z to send
     uint32_t t = millis() + 15000;
     while (millis() < t) {
       while (ModemSerial.available()) Serial.write(ModemSerial.read());
       delay(50);
     }
     Serial.println("\n     SMS send attempted.");
     Serial.println("     (If you saw +CMS ERROR: Network timeout = no signal or not registered; check antenna, wait for network, retry.)\n");
 #else
     Serial.println("[5] SEND_TEST_SMS=0 — skip SMS.\n");
 #endif

 #if AUTO_REPLY_SMS
     Serial.println("[5b] Enabling new-SMS indication (AT+CNMI=1,2,0,0,0)...");
     atCommand("AT+CNMI=1,2,0,0,0", 2000);  // new SMS forwarded to TE with full content
     Serial.println("     Auto-reply is ON: will reply to any incoming SMS.\n");
 #endif
 
 #if RUN_INTERNET_TEST
     // ----- Step 6: Basic internet attach test -----
     Serial.println("[6] Basic internet attach test...");
     // Signal quality and operator
     atCommand("AT+CSQ", 4000);
     atCommand("AT+COPS?", 4000);
 
     // Attach to packet service
     atCommand("AT+CGATT=1", 15000);
 
     // Set PDP context with your APN
     char apnCmd[64];
     snprintf(apnCmd, sizeof(apnCmd), "AT+CGDCONT=1,\"IP\",\"%s\"", APN);
     atCommand(apnCmd, 5000);
 
     // Open IP session and ask for IP address
     atCommand("AT+NETOPEN", 20000);
     atCommand("AT+IPADDR", 5000);
     Serial.println("[6] Internet test finished (even if it fails, the responses are useful for debugging).\n");
 #endif
   }
 
   Serial.println("----- Setup done. Loop: echoing modem (type AT in Serial Monitor) -----");
 #if AUTO_REPLY_SMS
   Serial.println("     Incoming SMS will trigger an automatic reply.");
 #endif
   Serial.println();
 }

 #if AUTO_REPLY_SMS
 // Parse sender from +CMT: "+number","","date" — return substring between first two quotes.
 static String parseCmtSender(const String& line) {
   int i = line.indexOf('"');
   if (i < 0) return "";
   int j = line.indexOf('"', i + 1);
   if (j < 0) return "";
   return line.substring(i + 1, j);
 }
 #endif

 void loop() {
 #if AUTO_REPLY_SMS
   static String modemLine;
   static bool nextLineIsBody = false;

   while (ModemSerial.available()) {
     char c = (char)ModemSerial.read();
     Serial.write(c);
     if (c == '\r' || c == '\n') {
       if (modemLine.length() > 0) {
         if (nextLineIsBody) {
           nextLineIsBody = false;  // was message body line after +CMT:, skip
         } else if (modemLine.startsWith("+CMT:")) {
           String sender = parseCmtSender(modemLine);
           if (sender.length() > 0) {
             Serial.printf("\n[SMS from %s] Auto-replying...\n", sender.c_str());
             sendSmsTo(sender.c_str(), AUTO_REPLY_MESSAGE);
             nextLineIsBody = true;  // next line is the message body, skip it for reply
           }
         }
         modemLine = "";
       }
     } else if (c >= 32 || c == '\t') {
       modemLine += c;
       if (modemLine.length() > 200) modemLine = "";  // prevent runaway
     }
   }
 #else
   while (ModemSerial.available()) {
     Serial.write(ModemSerial.read());
   }
 #endif

   // Echo Serial -> modem (so you can type AT commands in Serial Monitor)
   while (Serial.available()) {
     ModemSerial.write(Serial.read());
   }
   delay(20);
 }