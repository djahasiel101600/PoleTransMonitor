#include <Arduino.h>
#include "config.h"
#include "sensors/PzemSensor.h"
#include "sensors/OilTempSensor.h"
#include "fault/ThresholdEvaluator.h"
#include "fault/AlertManager.h"
#include "connectivity/WiFiManager.h"
#include "connectivity/BackendClient.h"
#include "connectivity/Sim7600Manager.h"

PzemSensor pzem;
OilTempSensor oilTemp;
ThresholdEvaluator evaluator;
AlertManager alertMgr;
WiFiManager wifiMgr;
BackendClient backendClient;
Sim7600Manager sim7600;

PzemReading pzemRead;
float oilTempC = NAN;
SensorData sensorData;
EvalParams evalParams;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("PoleTransMonitor starting...");

  pzem.begin(16, 17);
  oilTemp.begin(5);

  evalParams.nominalVoltage = NOMINAL_VOLTAGE;
  evalParams.nominalFreq = NOMINAL_FREQUENCY;
  evalParams.ratedCurrent = RATED_CURRENT;
  evalParams.ratedApparentPower = RATED_APPARENT_POWER;
  evaluator.setParams(evalParams);

  wifiMgr.begin(WIFI_SSID, WIFI_PASSWORD);
  backendClient.begin(BACKEND_URL, TRANSFORMER_ID);
  sim7600.begin(34, 32, 115200);

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
  sensorData.oilTemp = oilTempC;

  const char* condition = evaluator.evaluate(sensorData);

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
    backendClient.postReading(payload);
  }

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

  delay(SAMPLE_INTERVAL_MS);
}
