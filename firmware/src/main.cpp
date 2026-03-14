#include <Arduino.h>
#include <cctype>
#include <cstring>
#include "config.h"
#include "sensors/PzemSensor.h"
#include "sensors/OilTempSensor.h"
#include "fault/ThresholdEvaluator.h"
#include "fault/AlertManager.h"
#include "connectivity/WiFiManager.h"
#include "connectivity/BackendClient.h"
#if ENABLE_SIM
#include "connectivity/Sim7600Manager.h"
#endif

PzemSensor pzem;
OilTempSensor oilTemp;
ThresholdEvaluator evaluator;
AlertManager alertMgr;
WiFiManager wifiMgr;
BackendClient backendClient;
#if ENABLE_SIM
Sim7600Manager sim7600;
#endif

PzemReading pzemRead;
float oilTempC = NAN;
SensorData sensorData;
EvalParams evalParams;
#if DEBUG_SERIAL
static bool lastWiFiConnected = false;
#endif

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("PoleTransMonitor starting...");

  pzem.begin(16, 17);
  oilTemp.begin(5);
#if DEBUG_SERIAL
  Serial.println("[DEBUG] Sensors initialized (PZEM, MAX31865)");
#endif

  evalParams.nominalVoltage = NOMINAL_VOLTAGE;
  evalParams.nominalFreq = NOMINAL_FREQUENCY;
  evalParams.ratedCurrent = RATED_CURRENT;
  evalParams.ratedApparentPower = RATED_APPARENT_POWER;
  evaluator.setParams(evalParams);

  wifiMgr.begin(WIFI_SSID, WIFI_PASSWORD);
#if DEBUG_SERIAL
  Serial.printf("[DEBUG] WiFi connecting to %s...\n", WIFI_SSID);
  Serial.printf("[DEBUG] Backend: %s, Transformer ID: %d\n", BACKEND_URL, TRANSFORMER_ID);
#endif
  backendClient.begin(BACKEND_URL, TRANSFORMER_ID);
#if ENABLE_SIM
  sim7600.begin(SIM_RX_PIN, SIM_TX_PIN, SIM_BAUD, SIM_PWR_PIN);
#if defined(SEND_TEST_SMS_ON_BOOT) && SEND_TEST_SMS_ON_BOOT
  if (sim7600.isReady()) {
    if (sim7600.sendSms(SMS_RECIPIENT, TEST_SMS_MESSAGE)) {
      Serial.println("[DEBUG] Test SMS sent to " SMS_RECIPIENT);
    } else {
      Serial.println("[DEBUG] Test SMS failed");
    }
  } else {
    Serial.println("[DEBUG] Test SMS skipped (modem not ready)");
  }
#endif
#if defined(ENABLE_SMS_STATUS_REPLY) && ENABLE_SMS_STATUS_REPLY
  if (sim7600.isReady()) {
    sim7600.enableSmsIndication();
#if DEBUG_SERIAL
    Serial.println("[DEBUG] SMS status reply ON: send \"" SMS_STATUS_COMMAND "\" to get transformer status");
#endif
  }
#endif
#endif

  alertMgr.setDebounceMs(60000);
}

void loop() {
  wifiMgr.loop();

  pzem.read(pzemRead);
  oilTemp.read(oilTempC);

  sensorData.voltage = pzemRead.valid ? pzemRead.voltage : NAN;
  sensorData.current = pzemRead.valid ? pzemRead.current : NAN;
  sensorData.apparentPower = pzemRead.valid ? (pzemRead.voltage * pzemRead.current) : NAN;
  sensorData.powerFactor = pzemRead.valid ? pzemRead.powerFactor : NAN;
  sensorData.frequency = pzemRead.valid ? pzemRead.frequency : NAN;
  // Treat obviously invalid oil temp (sensor error) as no reading
  sensorData.oilTemp = (!isnan(oilTempC) && oilTempC >= -50.0f && oilTempC <= 200.0f)
                          ? oilTempC
                          : (float)NAN;

  const char* condition = evaluator.evaluate(sensorData);

#if DEBUG_SERIAL
  bool wifiConnected = wifiMgr.isConnected();
  if (wifiConnected && !lastWiFiConnected) {
    Serial.println("[DEBUG] WiFi connected");
  }
  lastWiFiConnected = wifiConnected;

  Serial.printf("[DEBUG PZEM] raw V=%.2f A=%.3f W=%.1f Wh=%.1f PF=%.2f Hz=%.2f valid=%s\n",
    pzemRead.voltage, pzemRead.current, pzemRead.power, pzemRead.energy,
    pzemRead.powerFactor, pzemRead.frequency, pzemRead.valid ? "yes" : "no");

  uint8_t oilFault = oilTemp.readFault();
  bool oilValid = !isnan(oilTempC) && oilTempC >= -50.0f && oilTempC <= 200.0f;
  Serial.printf("[DEBUG OIL] raw=%.2f C valid=%s fault=0x%02X",
    oilTempC, oilValid ? "yes" : "no", oilFault);
  if (oilFault) {
    if (oilFault & 0x08) Serial.print(" RTDopen");
    if (oilFault & 0x20) Serial.print(" RefLow");
    if (oilFault & 0x10) Serial.print(" RefHigh");
    if (oilFault & 0x04) Serial.print(" OVUV");
    if (oilFault & 0x40) Serial.print(" LowThresh");
    if (oilFault & 0x80) Serial.print(" HighThresh");
  }
  Serial.println();

  Serial.printf("[DEBUG] V=%.1f A=%.2f VA=%.0f PF=%.2f Hz=%.1f Oil=%.1f C | %s\n",
    sensorData.voltage, sensorData.current, sensorData.apparentPower,
    sensorData.powerFactor, sensorData.frequency, sensorData.oilTemp, condition);
#endif

  if (wifiMgr.isConnected()) {
    ReadingPayload payload = {
      .transformerId = TRANSFORMER_ID,
      .voltage = sensorData.voltage,
      .current = sensorData.current,
      .apparentPower = sensorData.apparentPower,
      .powerFactor = sensorData.powerFactor,
      .frequency = sensorData.frequency,
      .oilTemp = sensorData.oilTemp,
      .condition = condition,
    };
    int httpStatus = backendClient.postReadingWithStatus(payload);
#if DEBUG_SERIAL
    if (httpStatus >= 200 && httpStatus < 300) {
      Serial.println("[DEBUG] POST /api/readings/ OK");
    } else if (httpStatus == -1) {
      Serial.println("[DEBUG] POST skipped (WiFi not connected)");
    } else {
      Serial.printf("[DEBUG] POST /api/readings/ failed HTTP %d\n", httpStatus);
    }
#endif
  }

#if ENABLE_SIM
  if (alertMgr.shouldSendSms(condition)) {
    char msg[128];
    snprintf(msg, sizeof(msg), "PoleTransMonitor ALERT: %s", condition);
    if (sim7600.sendSms(SMS_RECIPIENT, msg)) {
      Serial.printf("SMS sent to %s: %s\n", SMS_RECIPIENT, condition);
    } else {
      Serial.printf("SMS failed for %s\n", condition);
    }
    alertMgr.markSent(condition);
  }

#if defined(ENABLE_SMS_STATUS_REPLY) && ENABLE_SMS_STATUS_REPLY
  {
    char sender[32];
    char body[128];
    if (sim7600.pollIncomingSms(sender, sizeof(sender), body, sizeof(body))) {
      // Case-insensitive match of body to status command (trimmed body already from pollIncomingSms)
      char cmd[32];
      size_t i = 0;
      while (body[i] && i < sizeof(cmd) - 1) {
        cmd[i] = (char)toupper((unsigned char)body[i]);
        i++;
      }
      cmd[i] = '\0';
      if (strcmp(cmd, SMS_STATUS_COMMAND) == 0) {
        // Format electrical parameters for SMS (single segment; n/a for invalid)
        char statusMsg[160];
        char v[12], a[12], va[12], pf[12], hz[12], oil[12];
        if (!isnan(sensorData.voltage)) snprintf(v, sizeof(v), "%.1f", sensorData.voltage); else strcpy(v, "n/a");
        if (!isnan(sensorData.current)) snprintf(a, sizeof(a), "%.2f", sensorData.current); else strcpy(a, "n/a");
        if (!isnan(sensorData.apparentPower)) snprintf(va, sizeof(va), "%.0f", sensorData.apparentPower); else strcpy(va, "n/a");
        if (!isnan(sensorData.powerFactor)) snprintf(pf, sizeof(pf), "%.2f", sensorData.powerFactor); else strcpy(pf, "n/a");
        if (!isnan(sensorData.frequency)) snprintf(hz, sizeof(hz), "%.1f", sensorData.frequency); else strcpy(hz, "n/a");
        if (!isnan(sensorData.oilTemp)) snprintf(oil, sizeof(oil), "%.1f", sensorData.oilTemp); else strcpy(oil, "n/a");
        snprintf(statusMsg, sizeof(statusMsg), "V=%s A=%s VA=%s PF=%s Hz=%s Oil=%sC | %s",
                 v, a, va, pf, hz, oil, condition ? condition : "?");
        if (sim7600.sendSms(sender, statusMsg)) {
#if DEBUG_SERIAL
          Serial.printf("[DEBUG] Status SMS sent to %s\n", sender);
#endif
        }
      }
    }
  }
#endif
#endif

  delay(SAMPLE_INTERVAL_MS);
}
