#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <HTTPUpdate.h>
#include <cctype>
#include <cmath>
#include <cstring>
#include "config.h"
#include "config/ConfigManager.h"
#include "sensors/PzemSensor.h"
#include "sensors/OilTempSensor.h"
#include "fault/ThresholdEvaluator.h"
#include "fault/AlertManager.h"
#include "connectivity/BackendClient.h"
#include "storage/OfflineBuffer.h"
#if ENABLE_SIM
#include "connectivity/Sim7600Manager.h"
#endif

// ---------------------------------------------------------------------------
// SMS template renderer
//
// Walks `tpl` and substitutes {token} placeholders with live sensor values.
// Returns true when rendered successfully (template was non-empty).
// Returns false when `tpl` is empty so the caller can use its built-in default.
//
// Supported tokens: {transformer}, {voltage}, {current}, {apparent_power},
//   {real_power}, {power_factor}, {frequency}, {energy_kwh}, {oil_temp},
//   {condition}, {loading_percent}
// ---------------------------------------------------------------------------
struct _SmsCtx
{
  const char *transformerName;
  float voltage;
  float current;
  float apparentPower;
  float realPower;
  float powerFactor;
  float frequency;
  float energyKwh;
  float oilTemp;
  const char *condition;
  float loadingPercent; // apparent_power / rated_apparent_power_va * 100
};

static void _fmtFloat(char *buf, size_t len, float v, const char *fmt, float sentinel = -1e9f)
{
  if (isnan(v) || v <= sentinel)
    strncpy(buf, "n/a", len);
  else
    snprintf(buf, len, fmt, (double)v);
  buf[len - 1] = '\0';
}

static bool _renderSmsTemplate(char *out, size_t outLen, const char *tpl,
                               const _SmsCtx &ctx)
{
  if (!tpl || !tpl[0])
    return false;

  size_t pos = 0;
  const char *p = tpl;

  while (*p && pos < outLen - 1)
  {
    if (*p != '{')
    {
      out[pos++] = *p++;
      continue;
    }

    // Find closing '}'
    const char *start = p + 1;
    const char *end = start;
    while (*end && *end != '}')
      end++;
    if (!*end)
    {
      // No closing brace — copy literally.
      out[pos++] = *p++;
      continue;
    }

    size_t tokenLen = (size_t)(end - start);
    char token[32] = {0};
    if (tokenLen < sizeof(token))
      memcpy(token, start, tokenLen);

    char val[32] = {0};
    if (strcmp(token, "transformer") == 0)
    {
      strncpy(val, ctx.transformerName && ctx.transformerName[0] ? ctx.transformerName : "?",
              sizeof(val) - 1);
    }
    else if (strcmp(token, "voltage") == 0)
    {
      _fmtFloat(val, sizeof(val), ctx.voltage, "%.1f");
    }
    else if (strcmp(token, "current") == 0)
    {
      _fmtFloat(val, sizeof(val), ctx.current, "%.2f");
    }
    else if (strcmp(token, "apparent_power") == 0)
    {
      _fmtFloat(val, sizeof(val), ctx.apparentPower, "%.0f");
    }
    else if (strcmp(token, "real_power") == 0)
    {
      _fmtFloat(val, sizeof(val), ctx.realPower, "%.1f");
    }
    else if (strcmp(token, "power_factor") == 0)
    {
      _fmtFloat(val, sizeof(val), ctx.powerFactor, "%.2f");
    }
    else if (strcmp(token, "frequency") == 0)
    {
      _fmtFloat(val, sizeof(val), ctx.frequency, "%.1f");
    }
    else if (strcmp(token, "energy_kwh") == 0)
    {
      _fmtFloat(val, sizeof(val), ctx.energyKwh, "%.2f");
    }
    else if (strcmp(token, "oil_temp") == 0)
    {
      _fmtFloat(val, sizeof(val), ctx.oilTemp, "%.1f");
    }
    else if (strcmp(token, "condition") == 0)
    {
      strncpy(val, ctx.condition && ctx.condition[0] ? ctx.condition : "?", sizeof(val) - 1);
    }
    else if (strcmp(token, "loading_percent") == 0)
    {
      _fmtFloat(val, sizeof(val), ctx.loadingPercent, "%.1f");
    }
    else
    {
      // Unknown token — copy literally including braces.
      snprintf(val, sizeof(val), "{%s}", token);
    }
    val[sizeof(val) - 1] = '\0';

    size_t vLen = strlen(val);
    if (pos + vLen >= outLen)
      break;
    memcpy(out + pos, val, vLen);
    pos += vLen;
    p = end + 1; // skip past '}'
  }

  out[pos] = '\0';
  return true;
}

PzemSensor pzem;
OilTempSensor oilTemp;
ThresholdEvaluator evaluator;
AlertManager alertMgr;
ConfigManager configMgr;
BackendClient backendClient;
WiFiManager wm; // library: config portal + WiFi connect
#if ENABLE_SIM
Sim7600Manager sim7600;
static char simPhoneNumber[32] = {0};
#endif

// Persistent WiFiManager parameters.
// These must outlive `setup()` because we may open the portal later via button long-press.
static WiFiManagerParameter *pBackendUrlParam = nullptr;
static WiFiManagerParameter *pTransformerIdParam = nullptr;
static WiFiManagerParameter *pDeviceKeyParam = nullptr;
static char transformerIdBuf[8];
static char deviceKeyBuf[ConfigManager::DEVICE_KEY_MAX];

// Portal trigger via long-press button (active-low with INPUT_PULLUP).
static unsigned long portalButtonPressedAtMs = 0;
static bool waitingForPortalButtonRelease = false;

static void syncDeviceProfileFromServer();

static bool checkAndOpenPortalByLongPress()
{
  // Optional "cooldown": require button release before re-arming.
  if (waitingForPortalButtonRelease)
  {
    if (digitalRead(PORTAL_BUTTON_GPIO) != LOW)
    {
      waitingForPortalButtonRelease = false;
      portalButtonPressedAtMs = 0;
    }
    return false;
  }

  const bool pressed = (digitalRead(PORTAL_BUTTON_GPIO) == LOW);
  if (!pressed)
  {
    portalButtonPressedAtMs = 0;
    return false;
  }

  if (portalButtonPressedAtMs == 0)
  {
    portalButtonPressedAtMs = millis();
    return false;
  }

  if (millis() - portalButtonPressedAtMs >= (unsigned long)PORTAL_LONG_PRESS_MS)
  {
    Serial.println("Button long-press detected: opening config portal...");
    wm.startConfigPortal("PoleTransMonitor-Setup", "config123"); // blocks until portal closes

    // Reload settings in case user changed backend URL / transformer ID.
    configMgr.load();
    backendClient.begin(configMgr.getBackendUrl(), configMgr.getTransformerId());
    syncDeviceProfileFromServer();
    Serial.println("Config portal closed.");

    waitingForPortalButtonRelease = true;
    portalButtonPressedAtMs = 0;
    return true;
  }

  return false;
}

PzemReading pzemRead;
float oilTempC = NAN;
SensorData sensorData;
EvalParams evalParams;
OfflineBuffer offlineBuffer;
#if DEBUG_SERIAL
static bool lastWiFiConnected = false;
#endif

static void syncDeviceProfileFromServer()
{
  if (WiFi.status() != WL_CONNECTED)
    return;
  if (!configMgr.getDeviceApiKey()[0])
    return;
#if ENABLE_SIM
  const char *phone = simPhoneNumber[0] ? simPhoneNumber : nullptr;
#else
  const char *phone = nullptr;
#endif
  bool resetPending = false;
  bool portalPending = false;
  bool rebootPending = false;
  if (backendClient.fetchDeviceConfig(configMgr.getDeviceApiKey(), configMgr, phone, &resetPending, &portalPending, &rebootPending))
  {
    // Sync server time while we have a working HTTP connection.
    backendClient.syncServerTime();

    EvalParams ep;
    configMgr.fillEvalParams(ep);
    evaluator.setParams(ep);

    if (resetPending)
    {
      if (pzem.resetEnergy())
      {
        backendClient.ackEnergyReset(configMgr.getDeviceApiKey());
#if DEBUG_SERIAL
        Serial.println("[DEBUG] PZEM energy counter reset (requested by backend)");
#endif
      }
      else
      {
#if DEBUG_SERIAL
        Serial.println("[DEBUG] PZEM energy reset FAILED");
#endif
      }
    }

    if (portalPending)
    {
      Serial.println("[INFO] Backend requested config portal open. Opening...");
      wm.startConfigPortal("PoleTransMonitor-Setup", "config123");
      configMgr.load();
      backendClient.begin(configMgr.getBackendUrl(), configMgr.getTransformerId());
      backendClient.ackPortalOpen(configMgr.getDeviceApiKey());
      Serial.println("[INFO] Config portal closed (backend-triggered).");
    }

    if (rebootPending)
    {
      Serial.println("[INFO] Backend requested device reboot. Rebooting...");
      backendClient.ackReboot(configMgr.getDeviceApiKey());
      delay(200); // Allow HTTP response to complete before restarting.
      ESP.restart();
    }

#if DEBUG_SERIAL
    Serial.printf("[DEBUG] Device profile synced: Vn=%.1f V Fn=%.1f Hz In=%.1f A Sn=%.0f VA\n",
                  ep.nominalVoltage, ep.nominalFreq, ep.ratedCurrent, ep.ratedApparentPower);
#endif
  }
  else
  {
#if DEBUG_SERIAL
    static unsigned long lastFailLogMs = 0;
    const unsigned long m = millis();
    if (m - lastFailLogMs > 120000)
    {
      lastFailLogMs = m;
      Serial.println("[DEBUG] device_config fetch failed (URL, Transformer ID, Device API key)");
    }
#endif
  }
}

void setup()
{
  Serial.begin(115200);
  delay(1000);
  Serial.println("PoleTransMonitor starting, this version next1...");

  pinMode(PORTAL_BUTTON_GPIO, INPUT_PULLUP);

  pzem.begin(16, 17);
  oilTemp.begin(5);
#if DEBUG_SERIAL
  Serial.println("[DEBUG] Sensors initialized (PZEM, MAX31865)");
#endif

  offlineBuffer.begin();

  configMgr.load();
  configMgr.fillEvalParams(evalParams);
  evaluator.setParams(evalParams);

  snprintf(transformerIdBuf, sizeof(transformerIdBuf), "%d", configMgr.getTransformerId());
  strncpy(deviceKeyBuf, configMgr.getDeviceApiKey(), sizeof(deviceKeyBuf) - 1);
  deviceKeyBuf[sizeof(deviceKeyBuf) - 1] = '\0';

  pBackendUrlParam = new WiFiManagerParameter(
      "server",
      "Server URL (e.g. http://192.168.1.6:8000)",
      configMgr.getBackendUrl(),
      128);
  pTransformerIdParam = new WiFiManagerParameter(
      "tid",
      "Transformer ID",
      transformerIdBuf,
      8);
  pDeviceKeyParam = new WiFiManagerParameter(
      "dkey",
      "Device API key (Dashboard → staff)",
      deviceKeyBuf,
      static_cast<int>(sizeof(deviceKeyBuf) - 1));

  wm.addParameter(pBackendUrlParam);
  wm.addParameter(pTransformerIdParam);
  wm.addParameter(pDeviceKeyParam);

  wm.setSaveConfigCallback([]()
                           {
                             configMgr.setBackendUrl(pBackendUrlParam->getValue());
                             int tid = atoi(pTransformerIdParam->getValue());
                             if (tid > 0)
                               configMgr.setTransformerId(tid);
                             configMgr.setDeviceApiKey(pDeviceKeyParam->getValue());
                             configMgr.save();
#if DEBUG_SERIAL
                             Serial.println("[DEBUG] Config saved: backend URL, transformer ID, device API key");
#endif
                           });

  Serial.println("WiFi: if config portal opens, connect to AP \"PoleTransMonitor-Setup\" (password: config123)");
  Serial.println("      then open in browser: http://192.168.4.1");
  bool connected = wm.autoConnect("PoleTransMonitor-Setup", "config123");
  if (connected)
  {
#if DEBUG_SERIAL
    Serial.printf("[DEBUG] WiFi connected to %s\n", WiFi.SSID().c_str());
#endif
  }
  else
  {
#if DEBUG_SERIAL
    Serial.println("[DEBUG] Config portal closed without connecting. Retrying...");
#endif
  }
#if DEBUG_SERIAL
  Serial.printf("[DEBUG] Backend: %s, Transformer ID: %d\n", configMgr.getBackendUrl(), configMgr.getTransformerId());
#endif
  backendClient.begin(configMgr.getBackendUrl(), configMgr.getTransformerId());
  syncDeviceProfileFromServer();
#if ENABLE_SIM
  sim7600.begin(SIM_RX_PIN, SIM_TX_PIN, SIM_BAUD, SIM_PWR_PIN);
#if defined(SEND_TEST_SMS_ON_BOOT) && SEND_TEST_SMS_ON_BOOT
  if (sim7600.isReady())
  {
    if (sim7600.sendSms(SMS_RECIPIENT, TEST_SMS_MESSAGE))
    {
      Serial.println("[DEBUG] Test SMS sent to " SMS_RECIPIENT);
    }
    else
    {
      Serial.println("[DEBUG] Test SMS failed");
    }
  }
  else
  {
    Serial.println("[DEBUG] Test SMS skipped (modem not ready)");
  }
#endif
#if defined(ENABLE_SMS_STATUS_REPLY) && ENABLE_SMS_STATUS_REPLY
  if (sim7600.isReady())
  {
    sim7600.enableSmsIndication();
#if DEBUG_SERIAL
    Serial.println("[DEBUG] SMS status reply ON: send \"" SMS_STATUS_COMMAND "\" to get transformer status");
#endif
  }
#endif
#endif

  // Query SIM own phone number and re-sync config so backend gets it
#if ENABLE_SIM
  if (sim7600.isReady())
  {
    if (sim7600.getOwnNumber(simPhoneNumber, sizeof(simPhoneNumber)))
    {
#if DEBUG_SERIAL
      Serial.printf("[DEBUG] SIM own number: %s\n", simPhoneNumber);
#endif
      syncDeviceProfileFromServer();
    }
  }
#endif

  alertMgr.setDebounceMs(60000);
}

void loop()
{
  // If the user long-presses the button, pause normal operation while portal is open.
  if (checkAndOpenPortalByLongPress())
  {
    return;
  }

  // Track WiFi connection state for reconnect rising-edge detection.
  static bool wasWiFiConnected = false;
  bool isWiFiConnected = (WiFi.status() == WL_CONNECTED);

  if (!isWiFiConnected)
  {
    static unsigned long lastReconnect = 0;
    if (millis() - lastReconnect >= 10000)
    {
      lastReconnect = millis();
      WiFi.reconnect();
    }
    wasWiFiConnected = false;
  }
  else if (isWiFiConnected && !wasWiFiConnected)
  {
    // Rising edge: WiFi just reconnected.  Replay any buffered offline readings.
    wasWiFiConnected = true;
    if (offlineBuffer.hasPending())
    {
#if DEBUG_SERIAL
      Serial.println("[OfflineBuffer] WiFi reconnected — replaying buffered readings");
#endif
      offlineBuffer.replayAll(backendClient);
    }
  }

  // Sample/publish cycle gate. Keeping this non-blocking helps detect long-press reliably.
  static unsigned long lastSampleMs = 0;
  const unsigned long nowMs = millis();

  static unsigned long lastProfileSyncMs = 0;
  if (WiFi.status() == WL_CONNECTED && configMgr.getDeviceApiKey()[0])
  {
    if (nowMs - lastProfileSyncMs >= (unsigned long)DEVICE_CONFIG_REFRESH_MS)
    {
      lastProfileSyncMs = nowMs;
      syncDeviceProfileFromServer();
    }
  }

  // OTA firmware check (less frequent than config sync).
  static unsigned long lastOtaCheckMs = 0;
  if (WiFi.status() == WL_CONNECTED)
  {
    if (nowMs - lastOtaCheckMs >= (unsigned long)OTA_CHECK_INTERVAL_MS)
    {
      lastOtaCheckMs = nowMs;
      char otaVersion[32] = {0};
      char otaUrl[256] = {0};
      if (backendClient.fetchCurrentFirmware(otaVersion, sizeof(otaVersion), otaUrl, sizeof(otaUrl)))
      {
        if (strcmp(otaVersion, FIRMWARE_VERSION) != 0)
        {
          Serial.printf("[OTA] New firmware available: %s (current: %s). Updating...\n",
                        otaVersion, FIRMWARE_VERSION);
          // Use WiFiClientSecure so OTA works on both HTTP (LAN) and HTTPS (production).
          // setInsecure() skips cert verification — acceptable for OTA over TLS since
          // the binary is authenticated by its own hash checked by the bootloader.
          WiFiClientSecure wifiClient;
          wifiClient.setInsecure();
          t_httpUpdate_return ret = httpUpdate.update(wifiClient, otaUrl);
          // On HTTP_UPDATE_OK the device reboots automatically.
          // Only log failures; no reboot needed on NO_UPDATES.
          if (ret == HTTP_UPDATE_FAILED)
          {
            Serial.printf("[OTA] Update failed: %s\n", httpUpdate.getLastErrorString().c_str());
          }
        }
#if DEBUG_SERIAL
        else
        {
          Serial.printf("[OTA] Firmware up to date (%s).\n", FIRMWARE_VERSION);
        }
#endif
      }
    }
  }

  if (nowMs - lastSampleMs < (unsigned long)SAMPLE_INTERVAL_MS)
  {
    delay(20);
    return;
  }
  lastSampleMs = nowMs;

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

  const char *condition = evaluator.evaluate(sensorData);

#if DEBUG_SERIAL
  if (isWiFiConnected && !lastWiFiConnected)
  {
    Serial.println("[DEBUG] WiFi connected");
  }
  lastWiFiConnected = isWiFiConnected;

  Serial.printf("[DEBUG PZEM] raw V=%.2f A=%.3f W=%.1f Wh=%.1f PF=%.2f Hz=%.2f valid=%s\n",
                pzemRead.voltage, pzemRead.current, pzemRead.power, pzemRead.energy,
                pzemRead.powerFactor, pzemRead.frequency, pzemRead.valid ? "yes" : "no");

  uint8_t oilFault = oilTemp.readFault();
  bool oilValid = !isnan(oilTempC) && oilTempC >= -50.0f && oilTempC <= 200.0f;
  Serial.printf("[DEBUG OIL] raw=%.2f C valid=%s fault=0x%02X",
                oilTempC, oilValid ? "yes" : "no", oilFault);
  if (oilFault)
  {
    if (oilFault & 0x08)
      Serial.print(" RTDopen");
    if (oilFault & 0x20)
      Serial.print(" RefLow");
    if (oilFault & 0x10)
      Serial.print(" RefHigh");
    if (oilFault & 0x04)
      Serial.print(" OVUV");
    if (oilFault & 0x40)
      Serial.print(" LowThresh");
    if (oilFault & 0x80)
      Serial.print(" HighThresh");
  }
  Serial.println();

  Serial.printf("[DEBUG] V=%.1f A=%.2f VA=%.0f PF=%.2f Hz=%.1f kWh=%.2f | %s\n",
                sensorData.voltage, sensorData.current, sensorData.apparentPower,
                sensorData.powerFactor, sensorData.frequency, pzemRead.energy, condition);
#endif

  ReadingPayload payload = {
      .transformerId = configMgr.getTransformerId(),
      .voltage = sensorData.voltage,
      .current = sensorData.current,
      .apparentPower = sensorData.apparentPower,
      .realPower = pzemRead.valid ? pzemRead.power : (float)NAN,
      .powerFactor = sensorData.powerFactor,
      .frequency = sensorData.frequency,
      .oilTemp = sensorData.oilTemp,
      .energyKwh = (pzemRead.valid && !isnan(pzemRead.energy) && pzemRead.energy >= 0.0f)
                       ? pzemRead.energy
                       : (float)NAN,
      .condition = condition,
  };

  if (isWiFiConnected && configMgr.isActive())
  {
    int httpStatus = backendClient.postReadingWithStatus(payload);
#if DEBUG_SERIAL
    if (httpStatus >= 200 && httpStatus < 300)
    {
      Serial.println("[DEBUG] POST /api/readings/ OK");
    }
    else if (httpStatus == -1)
    {
      Serial.println("[DEBUG] POST skipped (WiFi not connected)");
    }
    else
    {
      Serial.printf("[DEBUG] POST /api/readings/ failed HTTP %d\n", httpStatus);
    }
#endif
  }
  else if (!isWiFiConnected && configMgr.isActive())
  {
    // WiFi is down — buffer this reading to flash for later replay.
    uint32_t estimatedEpoch = backendClient.getEstimatedEpoch();
    offlineBuffer.push(payload, estimatedEpoch);
#if DEBUG_SERIAL
    if (estimatedEpoch == 0)
      Serial.println("[DEBUG] Offline: no time reference, reading not buffered");
    else
      Serial.printf("[DEBUG] Offline: reading buffered (est epoch=%u)\n", estimatedEpoch);
#endif
  }

#if ENABLE_SIM
  // Process incoming STATUS command first so we can suppress the alert broadcast
  // on the same tick. Without this guard, a STATUS reply and an alert firing in
  // the same 5-second cycle made it appear as though sending "STATUS" triggered
  // a broadcast to all recipients.  The alert debounce is NOT advanced here so
  // any pending alert fires normally on the very next cycle.
  bool statusReplied = false;
#if defined(ENABLE_SMS_STATUS_REPLY) && ENABLE_SMS_STATUS_REPLY
  {
    char sender[32];
    char body[128];
    if (sim7600.pollIncomingSms(sender, sizeof(sender), body, sizeof(body)))
    {
#if DEBUG_SERIAL
      Serial.printf("[DEBUG] Incoming SMS from %s body=\"%s\"\n", sender, body);
#endif
      // Case-insensitive match of body to status command (trimmed body already from pollIncomingSms)
      char cmd[32];
      size_t i = 0;
      while (body[i] && i < sizeof(cmd) - 1)
      {
        cmd[i] = (char)toupper((unsigned char)body[i]);
        i++;
      }
      cmd[i] = '\0';
      if (strcmp(cmd, SMS_STATUS_COMMAND) == 0)
      {
#if DEBUG_SERIAL
        Serial.printf("[DEBUG] Sending status reply to %s\n", sender);
#endif
        char statusMsg[320];
        float _statusRatedVa = configMgr.getRatedApparentPowerVa();
        _SmsCtx statusCtx = {
            .transformerName = configMgr.getTransformerName(),
            .voltage = sensorData.voltage,
            .current = sensorData.current,
            .apparentPower = sensorData.apparentPower,
            .realPower = (pzemRead.valid && !isnan(pzemRead.power) && pzemRead.power >= 0.0f)
                             ? pzemRead.power
                             : NAN,
            .powerFactor = sensorData.powerFactor,
            .frequency = sensorData.frequency,
            .energyKwh = (pzemRead.valid && !isnan(pzemRead.energy) && pzemRead.energy >= 0.0f)
                             ? pzemRead.energy
                             : NAN,
            .oilTemp = sensorData.oilTemp,
            .condition = condition,
            .loadingPercent = (!isnan(sensorData.apparentPower) && _statusRatedVa > 0.0f)
                                  ? (sensorData.apparentPower / _statusRatedVa * 100.0f)
                                  : NAN,
        };

        if (!_renderSmsTemplate(statusMsg, sizeof(statusMsg),
                                configMgr.getSmsStatusTemplate(), statusCtx))
        {
          // Blank template — use firmware built-in default.
          char v[12], a[12], va_[12], w[12], pf[12], hz[12], kwh[12], ot[12], lp[12];
          _fmtFloat(v, sizeof(v), sensorData.voltage, "%.1f");
          _fmtFloat(a, sizeof(a), sensorData.current, "%.2f");
          _fmtFloat(va_, sizeof(va_), sensorData.apparentPower, "%.0f");
          _fmtFloat(w, sizeof(w), statusCtx.realPower, "%.1f");
          _fmtFloat(pf, sizeof(pf), sensorData.powerFactor, "%.2f");
          _fmtFloat(hz, sizeof(hz), sensorData.frequency, "%.1f");
          _fmtFloat(kwh, sizeof(kwh), statusCtx.energyKwh, "%.2f");
          _fmtFloat(ot, sizeof(ot), sensorData.oilTemp, "%.1f");
          _fmtFloat(lp, sizeof(lp), statusCtx.loadingPercent, "%.1f");
          snprintf(statusMsg, sizeof(statusMsg),
                   "Voltage: %s V\nCurrent: %s A\nApparent Power: %s VA\n"
                   "Real Power: %s W\nPower Factor: %s\nFrequency: %s Hz\n"
                   "Energy: %s kWh\nOil Temp: %s C\nLoading: %s%%\nStatus: %s",
                   v, a, va_, w, pf, hz, kwh, ot, lp, condition ? condition : "?");
        }
        if (sim7600.sendSms(sender, statusMsg))
        {
          statusReplied = true;
#if DEBUG_SERIAL
          Serial.printf("[DEBUG] Status SMS sent to %s\n", sender);
#endif
        }
      }
    }
  }
#endif

  // Skip the alert broadcast on the same tick where a STATUS reply was sent.
  // The debounce timer is untouched so the alert fires on the next cycle if needed.
  if (!statusReplied && configMgr.isActive() && alertMgr.shouldSendSms(condition))
  {
    char msg[320];
    // Build render context from current sensor values.
    float _alertRatedVa = configMgr.getRatedApparentPowerVa();
    _SmsCtx smsCtx = {
        .transformerName = configMgr.getTransformerName(),
        .voltage = sensorData.voltage,
        .current = sensorData.current,
        .apparentPower = sensorData.apparentPower,
        .realPower = (pzemRead.valid && !isnan(pzemRead.power) && pzemRead.power >= 0.0f)
                         ? pzemRead.power
                         : NAN,
        .powerFactor = sensorData.powerFactor,
        .frequency = sensorData.frequency,
        .energyKwh = (pzemRead.valid && !isnan(pzemRead.energy) && pzemRead.energy >= 0.0f)
                         ? pzemRead.energy
                         : NAN,
        .oilTemp = sensorData.oilTemp,
        .condition = condition,
        .loadingPercent = (!isnan(sensorData.apparentPower) && _alertRatedVa > 0.0f)
                              ? (sensorData.apparentPower / _alertRatedVa * 100.0f)
                              : NAN,
    };

    if (!_renderSmsTemplate(msg, sizeof(msg), configMgr.getSmsAlertTemplate(), smsCtx))
    {
      // Blank template — use firmware built-in default.
      snprintf(msg, sizeof(msg), "PoleTransMonitor ALERT: %s", condition);
    }

    bool anyOk = false;

    const char *csv = configMgr.getSmsRecipientsCsv();
    if (csv && csv[0])
    {
      const size_t RECIP_MAX = 40;
      char recipient[RECIP_MAX];

      const char *p = csv;
      while (*p)
      {
        // Skip separators/whitespace
        while (*p == ',' || *p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')
          p++;
        if (!*p)
          break;

        size_t n = 0;
        while (*p && *p != ',' && n < RECIP_MAX - 1)
        {
          recipient[n++] = *p++;
        }
        recipient[n] = '\0';

        // Trim trailing whitespace
        while (n > 0 && (recipient[n - 1] == ' ' || recipient[n - 1] == '\t'))
        {
          recipient[n - 1] = '\0';
          n--;
        }

        if (recipient[0] && sim7600.sendSms(recipient, msg))
        {
          Serial.printf("SMS sent to %s: %s\n", recipient, condition);
          anyOk = true;
        }

        // Move past comma if present
        if (*p == ',')
          p++;
      }
    }
    else
    {
      // Fallback to compile-time recipient if backend has none selected.
      if (sim7600.sendSms(SMS_RECIPIENT, msg))
      {
        Serial.printf("SMS sent to %s: %s\n", SMS_RECIPIENT, condition);
        anyOk = true;
      }
      else
      {
        Serial.printf("SMS failed for %s\n", condition);
      }
    }

    if (anyOk)
      alertMgr.markSent(condition);
  }
#endif
}
