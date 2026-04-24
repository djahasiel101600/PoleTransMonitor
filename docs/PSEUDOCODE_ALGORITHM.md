# PoleTransMonitor Pseudocode and Algorithm

This document describes the current runtime behavior of the system in a flowchart-friendly way.

It is divided into two major parts:

1. Web App Algorithm
2. Device Algorithm

The term "Web App" here covers:

- Frontend: React dashboard
- Backend: Django API + WebSocket server

---

## 1. Web App Algorithm

## 1.1 System Purpose

The web app performs these main functions:

1. Authenticate users
2. Show transformer list and dashboard data
3. Receive live readings through WebSocket for real-time display
4. Accept device readings through REST API
5. Store readings directly or aggregate them first based on configured interval
6. Create and show alerts
7. Manage transformers, contacts, reports, and users
8. Provide device configuration back to the ESP32

---

## 1.2 Web App High-Level Flow

### Algorithm: Overall Web App Runtime

```text
START WEB APP

LOAD frontend application
WRAP application in authentication provider

IF user has no valid access token THEN
    SHOW login screen
    ALLOW registration screen if selected
ELSE
    LOAD main dashboard
END IF

AFTER login is valid:
    FETCH transformers from backend
    SELECT current transformer
    FETCH latest readings, alerts, insights, and recent history
    OPEN WebSocket connection for selected transformer

WHILE user is using the app DO
    IF WebSocket receives new reading THEN
        UPDATE live dashboard immediately
        MARK device as online
    END IF

    IF user changes selected transformer THEN
        FETCH data for new transformer
        RECONNECT WebSocket to that transformer
    END IF

    IF user opens reports THEN
        FETCH filtered readings or alerts
        DISPLAY charts and tables
        ALLOW CSV export
    END IF

    IF admin edits transformer settings THEN
        SAVE updated transformer config
        REFRESH transformer list
    END IF
END WHILE

END WEB APP
```

---

## 1.3 Frontend Authentication Flow

### Algorithm: User Login and Access Control

```text
START LOGIN FLOW

USER enters username and password
SEND credentials to backend token endpoint

IF backend accepts credentials THEN
    RECEIVE access token and refresh token
    STORE tokens locally
    LOAD authenticated user profile

    IF user is approved THEN
        OPEN dashboard
    ELSE
        SHOW pending approval message
    END IF
ELSE
    SHOW login error
END IF

IF access token expires THEN
    TRY refresh token

    IF refresh succeeds THEN
        STORE new access token
        CONTINUE session
    ELSE
        LOG OUT user
        RETURN to login screen
    END IF
END IF

END LOGIN FLOW
```

---

## 1.4 Dashboard Initial Load Flow

### Algorithm: Load Dashboard Data

```text
START DASHBOARD LOAD

CHECK authenticated user

FETCH transformer list

IF transformer list is empty THEN
    SHOW empty dashboard state
    STOP
END IF

SELECT transformer:
    IF previous transformer still exists THEN
        KEEP it selected
    ELSE
        SELECT first transformer
    END IF

FOR selected transformer DO
    FETCH latest readings
    FETCH alerts
    FETCH transformer insights
    FETCH recent readings for sparkline/history
END FOR

DISPLAY:
    live meters
    transformer insights
    alerts list
    reports section
    management sections if admin

END DASHBOARD LOAD
```

---

## 1.5 Real-Time Dashboard Update Flow

### Algorithm: Frontend WebSocket Monitoring

```text
START WEBSOCKET MONITORING

IF no selected transformer OR no access token THEN
    DO NOT connect
    STOP
END IF

CREATE WebSocket URL using selected transformer ID and access token
OPEN WebSocket connection

WHEN socket opens:
    SET connected = true

WHEN message arrives:
    PARSE JSON payload

    IF payload type = reading_update AND payload contains reading THEN
        SAVE reading as latest live reading
        SET deviceOnline = true
        RESET stale timer
    END IF

WHEN stale timer expires:
    SET deviceOnline = false

WHEN socket closes:
    SET connected = false
    SET deviceOnline = false
    WAIT 3 seconds
    RECONNECT

END WEBSOCKET MONITORING
```

### Notes for Flowchart

- Live dashboard uses WebSocket reading first
- If no live reading exists yet, it falls back to latest fetched reading
- Device online state depends on receiving recent WebSocket readings

---

## 1.6 Backend Device Reading Ingest Flow

This is the most important backend algorithm because it now includes configurable database aggregation.

### Algorithm: Receive Reading from Device

```text
START RECEIVE DEVICE READING

DEVICE sends POST /api/readings/
BACKEND validates request payload

IF payload is invalid THEN
    RETURN HTTP 400
    STOP
END IF

GET transformer from transformer_id

IF transformer is inactive THEN
    RETURN HTTP 403
    STOP
END IF

BUILD payload_data from request:
    voltage
    current
    apparent_power
    real_power
    power_factor
    frequency
    oil_temp
    energy_kwh
    condition

READ transformer.reading_interval_minutes

IF reading_interval_minutes <= 0 THEN
    SAVE full reading directly into Reading table
    UPDATE transformer.last_seen

    IF condition is not normal THEN
        CREATE alert record
    END IF

    BROADCAST reading to WebSocket clients
    RETURN HTTP 201 with saved reading
    STOP
END IF

IF reading_interval_minutes > 0 THEN
    BROADCAST live reading immediately to WebSocket clients
    UPDATE transformer.last_seen

    IF condition is not normal THEN
        CREATE alert record immediately
    END IF

    SAVE incoming reading into ReadingBuffer table

    CALL flush_buffer_if_due(transformer, now)

    RETURN HTTP 201 with accepted live payload
END IF

END RECEIVE DEVICE READING
```

---

## 1.7 Backend Aggregation Flow

### Algorithm: Flush Buffered Readings If Interval Window Has Passed

```text
FUNCTION flush_buffer_if_due(transformer, now)

READ interval = transformer.reading_interval_minutes

IF interval <= 0 THEN
    RETURN no action
END IF

COMPUTE window_start by rounding current time down to the nearest interval boundary

SELECT all ReadingBuffer rows for this transformer
WHERE row.timestamp < window_start
ORDER BY timestamp ascending

IF no rows found THEN
    RETURN no action
END IF

SET latest_row = last row in selected rows

COMPUTE aggregated reading as:
    voltage = average of valid voltage values
    current = average of valid current values
    apparent_power = average of valid apparent_power values
    real_power = average of valid real_power values
    power_factor = average of valid power_factor values
    frequency = average of valid frequency values
    oil_temp = average of valid oil_temp values
    energy_kwh = latest_row.energy_kwh
    condition = most severe condition found in the interval

SAVE aggregated reading into Reading table
DELETE flushed rows from ReadingBuffer table

RETURN aggregated reading

END FUNCTION
```

### Severity Rule Used by Backend

```text
normal
heavy_load
heavy_peak_load
poor_power_quality
abnormal
danger_zone
overload
severe_overload
critical
```

The backend stores the highest severity found during the buffered interval.

---

## 1.8 Why Real-Time Display Still Works

### Algorithm: Separation of Live Display and Database Storage

```text
IF interval aggregation is disabled THEN
    one incoming reading = one live update + one database row
ELSE
    one incoming reading = one live update + zero or one buffered write
    many buffered readings later become one aggregated database row
END IF
```

### Flowchart Meaning

- Real-time path = WebSocket broadcast immediately
- Historical storage path = direct save or interval aggregation
- Alerts are still created in real time

---

## 1.9 Backend Device Configuration Sync Flow

### Algorithm: Provide Device Configuration

```text
START DEVICE CONFIG REQUEST

DEVICE sends GET /api/transformers/{id}/device_config/
DEVICE includes X-Device-Key header
OPTIONAL: device also includes X-Sim-Phone header

BACKEND verifies device key

IF key missing OR invalid THEN
    RETURN error
    STOP
END IF

IF SIM phone number header is present THEN
    UPDATE transformer.phone_number
END IF

RETURN JSON with:
    transformer_id
    name
    nominal_voltage
    nominal_freq
    rated_kva
    rated_current
    rated_apparent_power_va
    is_active
    sms_recipients
    pending_energy_reset

END DEVICE CONFIG REQUEST
```

---

## 1.10 Backend Reset Flow

### Algorithm: Reset Transformer from Dashboard

```text
START TRANSFORMER RESET

ADMIN requests reset for transformer

GET latest reading for transformer
SET energy offset = latest reading energy_kwh OR 0

SAVE transformer.energy_kwh_offset = offset
SAVE transformer.pending_energy_reset = true

DELETE all alerts for transformer
DELETE all stored readings for transformer

RETURN success

END TRANSFORMER RESET
```

### Algorithm: Firmware Acknowledges Energy Reset

```text
START ACK ENERGY RESET

DEVICE sends POST /api/transformers/{id}/ack_energy_reset/
DEVICE includes X-Device-Key header

VERIFY device key

IF valid THEN
    SET transformer.pending_energy_reset = false
    RETURN success
ELSE
    RETURN forbidden
END IF

END ACK ENERGY RESET
```

---

## 1.11 Reports Flow

### Algorithm: Reports and CSV Export

```text
START REPORTS FLOW

USER selects reports tab
USER chooses filters:
    date range
    conditions
    voltage min/max
    current min/max
    power factor min/max

IF reports tab = readings THEN
    FETCH filtered readings with pagination
    SHOW trend chart and readings table
END IF

IF reports tab = alerts THEN
    FETCH filtered alerts with pagination
    SHOW alerts table
END IF

IF user clicks export CSV THEN
    BACKEND streams matching rows as CSV file
END IF

END REPORTS FLOW
```

---

## 1.12 Web App Flowchart Blocks Suggestion

Use these major blocks when drawing the web app flowchart:

1. User Login
2. Load Transformers
3. Select Transformer
4. Fetch Initial Data
5. Open WebSocket
6. Receive Live Reading
7. Update Dashboard
8. Device POST Reading
9. Validate Reading
10. Check Transformer Active
11. Check Interval Setting
12. Save Directly or Buffer
13. Create Alert
14. Broadcast Live Update
15. Flush Buffer to Final Reading
16. Reports / Export CSV
17. Transformer Management / Device Config Sync

---

## 2. Device Algorithm

## 2.1 Device Purpose

The device performs these main functions:

1. Load saved configuration from non-volatile storage
2. Connect to WiFi using WiFiManager
3. Allow local config portal using long-press button
4. Read electrical data from PZEM
5. Read oil temperature sensor
6. Evaluate transformer condition using thresholds
7. Post readings to backend over WiFi
8. Sync transformer profile and SMS recipients from backend
9. Send SMS alerts through SIM module when condition is abnormal
10. Handle remote energy reset requests

---

## 2.2 Device High-Level Runtime Flow

### Algorithm: Full Device Runtime

```text
START DEVICE

INITIALIZE serial
INITIALIZE button
INITIALIZE sensors
LOAD saved configuration from NVS
LOAD cached transformer profile from NVS

START WiFiManager auto connect

IF WiFi connects THEN
    INITIALIZE backend client
    SYNC device profile from server
END IF

IF SIM module enabled THEN
    INITIALIZE SIM module
    TRY read own phone number
    IF phone number found THEN
        SYNC device profile again so backend can store SIM number
    END IF
END IF

SET alert debounce timer

LOOP forever:
    CHECK long-press button for config portal
    MAINTAIN WiFi connection
    PERIODICALLY sync device profile from backend
    WAIT until sample interval is due
    READ sensors
    BUILD sensor data
    EVALUATE condition
    IF WiFi connected AND device is active THEN
        POST reading to backend
    END IF
    IF SIM enabled THEN
        SEND SMS alert if condition requires it
        PROCESS SMS status requests if enabled
    END IF
END LOOP
```

---

## 2.3 Device Boot and Setup Flow

### Algorithm: setup()

```text
START setup

BEGIN serial output
CONFIGURE portal button as input pullup

INITIALIZE PZEM sensor
INITIALIZE oil temperature sensor

LOAD configuration from NVS:
    backend URL
    transformer ID
    device API key
    active flag
    cached transformer profile

FILL threshold evaluator parameters from cached profile

CREATE WiFiManager form fields:
    backend URL
    transformer ID
    device API key

SET WiFiManager save callback:
    store backend URL
    store transformer ID
    store device API key
    save to NVS

OPEN WiFi auto connect portal if needed

WHEN WiFi is connected:
    initialize backend client
    sync device profile from server

IF SIM is enabled THEN
    initialize modem
    optionally enable SMS indication
    try to read device phone number
    if phone number exists then sync profile from server again
END IF

SET alert debounce to 60 seconds

END setup
```

---

## 2.4 Local Configuration Portal Flow

### Algorithm: Open Config Portal by Long Press

```text
FUNCTION checkAndOpenPortalByLongPress()

IF system is waiting for button release THEN
    IF button is released THEN
        clear waiting state
    END IF
    RETURN false
END IF

IF button is not pressed THEN
    clear press start time
    RETURN false
END IF

IF button was just pressed THEN
    record press start time
    RETURN false
END IF

IF button press duration >= configured long press time THEN
    OPEN WiFiManager config portal
    WAIT until user finishes configuration

    RELOAD config from NVS
    REINITIALIZE backend client
    SYNC device profile from server

    REQUIRE button release before re-arming
    RETURN true
END IF

RETURN false

END FUNCTION
```

---

## 2.5 Device Configuration Storage Flow

### Algorithm: Load Configuration from NVS

```text
FUNCTION load_config()

OPEN Preferences namespace

IF open fails THEN
    USE compile-time defaults
    SET device active = true
    CLEAR SMS recipients cache
    LOAD default transformer profile
    RETURN
END IF

READ backend URL from NVS or default
READ transformer ID from NVS or default
READ device API key from NVS
READ active flag from NVS

IF cached transformer profile exists THEN
    LOAD nominal voltage
    LOAD nominal frequency
    LOAD rated current
    LOAD rated apparent power
ELSE
    LOAD compile-time default profile
END IF

CLOSE Preferences

END FUNCTION
```

### Algorithm: Save Configuration to NVS

```text
FUNCTION save_config()

OPEN Preferences namespace
SAVE backend URL
SAVE transformer ID
SAVE device API key
SAVE active flag
SAVE cached transformer profile
CLOSE Preferences

END FUNCTION
```

---

## 2.6 Device Profile Sync from Backend

### Algorithm: Sync Device Profile From Server

```text
FUNCTION syncDeviceProfileFromServer()

IF WiFi is not connected THEN
    RETURN
END IF

IF device API key is empty THEN
    RETURN
END IF

OPTIONALLY include SIM phone number header

SEND GET request to backend device_config endpoint

IF request succeeds THEN
    READ returned values:
        nominal_voltage
        nominal_freq
        rated_kva
        rated_current
        rated_apparent_power_va
        is_active
        sms_recipients
        pending_energy_reset

    UPDATE local SMS recipients cache
    UPDATE local active flag
    UPDATE cached transformer profile in NVS
    UPDATE evaluator parameters

    IF pending_energy_reset = true THEN
        RESET PZEM energy counter

        IF reset succeeds THEN
            SEND ack_energy_reset to backend
        END IF
    END IF
ELSE
    KEEP current local cached values
END IF

END FUNCTION
```

---

## 2.7 Main Device Loop Flow

### Algorithm: loop()

```text
START loop

IF long-press portal was opened THEN
    RETURN to next loop cycle
END IF

IF WiFi is disconnected THEN
    every 10 seconds attempt WiFi reconnect
END IF

IF enough time has passed for device profile refresh THEN
    syncDeviceProfileFromServer()
END IF

IF sample interval has not elapsed yet THEN
    short delay
    RETURN
END IF

READ PZEM values
READ oil temperature value

BUILD sensorData:
    voltage
    current
    apparentPower = voltage × current
    powerFactor
    frequency
    oilTemp only if within valid range

CALCULATE condition = evaluator.evaluate(sensorData)

IF WiFi is connected AND device is active THEN
    BUILD payload with:
        transformerId
        voltage
        current
        apparentPower
        realPower
        powerFactor
        frequency
        oilTemp
        energyKwh
        condition

    POST payload to backend
END IF

IF SIM is enabled THEN
    HANDLE SMS alert logic
    HANDLE incoming SMS status requests
END IF

END loop
```

---

## 2.8 Sensor Reading and Validation Flow

### Algorithm: Read and Normalize Sensor Values

```text
READ PZEM sensor
READ oil temperature sensor

IF PZEM reading is valid THEN
    voltage = measured voltage
    current = measured current
    apparent_power = voltage × current
    real_power = measured power
    power_factor = measured power factor
    frequency = measured frequency
    energy_kwh = measured energy
ELSE
    SET electrical values to invalid / NaN
END IF

IF oil temperature is within acceptable physical range THEN
    use oil temperature
ELSE
    mark oil temperature invalid
END IF
```

---

## 2.9 Threshold Evaluation Flow

### Algorithm: Evaluate Transformer Condition

```text
INPUT sensorData
INPUT evaluator parameters:
    nominalVoltage
    nominalFreq
    ratedCurrent
    ratedApparentPower

COMPARE measured values against thresholds

DETERMINE condition such as:
    normal
    heavy_peak_load
    danger_zone
    overload
    severe_overload
    heavy_load
    abnormal
    poor_power_quality
    critical

RETURN selected condition
```

### Flowchart Note

You can draw this as one decision block or as multiple decision branches:

1. Voltage check
2. Current check
3. Apparent power check
4. Frequency check
5. Power factor check
6. Oil temperature check
7. Select highest-priority condition

---

## 2.10 Posting Reading to Backend

### Algorithm: Send Reading Over HTTP

```text
FUNCTION postReading(payload)

IF WiFi is not connected THEN
    RETURN failure
END IF

CREATE HTTP POST request to /api/readings/
SET Content-Type = application/json

BUILD JSON body from payload

ONLY include real_power if valid
ONLY include power_factor if valid and between 0 and 1
ONLY include energy_kwh if valid and non-negative

SEND HTTP POST
RETURN HTTP status code

END FUNCTION
```

---

## 2.11 SMS Alert Flow

### Algorithm: Send SMS Alerts

```text
IF SIM is enabled AND device is active THEN
    IF alert manager says SMS should be sent for this condition THEN
        BUILD alert message = "PoleTransMonitor ALERT: <condition>"

        IF backend-provided SMS recipients list is not empty THEN
            FOR each recipient in CSV list DO
                SEND SMS
                IF at least one send succeeds THEN
                    remember success
                END IF
            END FOR
        ELSE
            SEND SMS to fallback compile-time recipient
        END IF

        IF any SMS send succeeded THEN
            mark this condition as sent in alert manager
        END IF
    END IF
END IF
```

### Alert Behavior Note

- SMS is debounced to avoid repeated sending too quickly
- SMS recipients are synced from backend device configuration

---

## 2.12 SMS Status Reply Flow

### Algorithm: Respond to Incoming Status Request SMS

```text
IF SMS status reply feature is enabled THEN
    CHECK modem for incoming SMS

    IF incoming SMS exists THEN
        READ sender number
        READ body text
        CONVERT body to uppercase

        IF body matches configured status command THEN
            BUILD status message containing:
                voltage
                current
                apparent power
                real power
                power factor
                frequency
                energy
                current condition

            SEND status SMS back to sender
        END IF
    END IF
END IF
```

---

## 2.13 Device Flowchart Blocks Suggestion

Use these major blocks when drawing the device flowchart:

1. Power On
2. Initialize Sensors
3. Load NVS Config
4. Start WiFiManager
5. Connect WiFi
6. Sync Device Profile
7. Init SIM Module
8. Main Loop Start
9. Check Long Press
10. Reconnect WiFi if Needed
11. Check Profile Sync Timer
12. Check Sample Timer
13. Read PZEM
14. Read Oil Temp
15. Evaluate Condition
16. Device Active?
17. Post Reading to Backend
18. SMS Alert Needed?
19. Send SMS
20. Incoming SMS Status Request?
21. Send Status Reply
22. Repeat Loop

---

## 3. Simplified Combined End-to-End Flow

If you want one single end-to-end flowchart for the whole system, use this version:

### Algorithm: End-to-End System Flow

```text
START SYSTEM

DEVICE powers on
DEVICE loads config and connects to WiFi
DEVICE syncs profile and active state from backend

USER logs in to web app
WEB APP loads transformer list and opens WebSocket

LOOP:
    DEVICE reads sensors
    DEVICE evaluates condition

    IF device is active AND WiFi is connected THEN
        DEVICE sends reading to backend
    END IF

    BACKEND validates reading

    IF transformer save interval <= 0 THEN
        BACKEND saves reading directly
    ELSE
        BACKEND stores reading in buffer
        BACKEND aggregates older buffered readings when interval is due
    END IF

    BACKEND creates alert if condition is abnormal
    BACKEND broadcasts live reading through WebSocket

    FRONTEND receives live reading
    FRONTEND updates dashboard immediately

    IF abnormal condition requires SMS THEN
        DEVICE sends SMS to configured recipients
    END IF
END LOOP
```

---

## 4. Flowchart Drawing Tip

For best results, draw separate flowcharts for:

1. Frontend user flow
2. Backend reading ingest flow
3. Device main loop flow
4. Device config sync flow

That will be clearer than forcing everything into one large diagram.
