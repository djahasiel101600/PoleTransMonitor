# PoleTransMonitor Mermaid Flowcharts (Thesis Style)

This version simplifies the previous diagrams into higher-level flowcharts with fewer boxes.

Use these when you need clean, presentation-ready visuals for thesis chapters.

---

## 1. System Architecture Flow

```mermaid
flowchart LR
    A[ESP32 Device] -->|HTTP Reading Post| B[Django Backend]
    B -->|WebSocket Reading Update| C[React Dashboard]
    C -->|Configuration and Admin Actions| B
    A -->|Device Config Request| B
    A -->|SMS Alerts| D[Recipients]
```

---

## 2. Web App Operational Flow

```mermaid
flowchart TD
    A([Start Web App]) --> B{Authenticated?}
    B -- No --> C[Login or Register]
    C --> B
    B -- Yes --> D[Load Dashboard and Transformers]
    D --> E[Fetch Initial Data]
    E --> F[Open WebSocket]
    F --> G[Render Monitoring and Reports]

    G --> H{User Event}
    H -- Live Reading --> I[Update Live UI]
    I --> H
    H -- Change Transformer --> J[Refetch and Reconnect]
    J --> H
    H -- Reports or Export --> K[Fetch Filtered Data or CSV]
    K --> H
    H -- Admin Update --> L[Save Settings and Refresh]
    L --> H
```

---

## 3. Backend Reading Ingest and Storage Flow

```mermaid
flowchart TD
    A([POST Device Reading]) --> B[Validate Payload and Transformer State]
    B --> C{Valid and Active?}
    C -- No --> D[Reject Request]

    C -- Yes --> E[Prepare Reading Data]
    E --> F{Interval Aggregation Enabled?}

    F -- No --> G[Save Reading Directly]
    G --> H[Update Last Seen and Alert if Needed]
    H --> I[Broadcast Saved Reading]
    I --> J[Return 201]

    F -- Yes --> K[Broadcast Live Reading]
    K --> L[Update Last Seen and Alert if Needed]
    L --> M[Save to Buffer]
    M --> N[Flush Due Buffer Window]
    N --> J
```

---

## 4. Backend Aggregation Sub-Flow

```mermaid
flowchart TD
    A([Flush Buffer]) --> B{Any Completed Window Data?}
    B -- No --> C[No Action]
    B -- Yes --> D[Compute Aggregate Values]
    D --> E[Select Most Severe Condition]
    E --> F[Create One Final Reading Row]
    F --> G[Delete Flushed Buffer Rows]
```

---

## 5. Device Runtime Flow

```mermaid
flowchart TD
    A([Power On]) --> B[Initialize Sensors and Load NVS Config]
    B --> C[Connect WiFi and Sync Device Profile]
    C --> D{SIM Enabled?}
    D -- Yes --> E[Initialize SIM and SMS Features]
    D -- No --> F[Enter Main Loop]
    E --> F

    F --> G[Read Sensors and Evaluate Condition]
    G --> H{WiFi Connected and Device Active?}
    H -- No --> I[Skip Backend Post]
    H -- Yes --> J[Post Reading to Backend]

    I --> K{SMS Needed?}
    J --> K
    K -- Yes --> L[Send SMS Alert or Status Reply]
    K -- No --> M[Continue Loop]
    L --> M
    M --> F
```

---

## 6. Device Configuration Sync Flow

```mermaid
flowchart TD
    A([Sync Request]) --> B{WiFi and Device Key Available?}
    B -- No --> C[Keep Current Local Config]
    B -- Yes --> D[GET Device Config from Backend]
    D --> E{Request Successful?}
    E -- No --> C
    E -- Yes --> F[Update Active Flag, Profile, and Recipients]
    F --> G{Pending Energy Reset?}
    G -- No --> H[Use Updated Settings]
    G -- Yes --> I[Reset PZEM Energy and Ack Backend]
    I --> H
```

---

## 7. End-to-End Monitoring Cycle

```mermaid
flowchart TD
    A([Start Cycle]) --> B[Device Samples Electrical Data]
    B --> C[Device Evaluates Condition]
    C --> D[Device Sends Reading]
    D --> E[Backend Validates and Processes]
    E --> F{Direct Save or Buffered Save}
    F --> G[Alert Handling]
    G --> H[WebSocket Broadcast]
    H --> I[Dashboard Live Update]
    I --> J{Abnormal Condition?}
    J -- Yes --> K[Device Sends SMS Alert]
    J -- No --> L[Next Sampling Cycle]
    K --> L
```

---

## 8. Suggested Thesis Figure Order

Use this order in your manuscript:

1. System Architecture Flow
2. Web App Operational Flow
3. Backend Reading Ingest and Storage Flow
4. Backend Aggregation Sub-Flow
5. Device Runtime Flow
6. End-to-End Monitoring Cycle
