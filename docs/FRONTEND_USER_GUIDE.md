# Pole Transformer Monitor — Frontend User Guide

This guide explains how to use the web dashboard to monitor pole transformers in real time.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Selecting a Transformer](#3-selecting-a-transformer)
4. [Live Readings](#4-live-readings)
5. [Understanding Condition Badges](#5-understanding-condition-badges)
6. [Alerts](#6-alerts)
7. [Live Connection Status](#7-live-connection-status)
8. [Empty States & Troubleshooting](#8-empty-states--troubleshooting)
9. [Display & Accessibility](#9-display--accessibility)

---

## 1. Prerequisites

Before using the dashboard:

- **Backend** must be running (Django REST API and, for live updates, WebSocket server)
- **Redis** must be running for WebSocket support
- **ESP32** firmware must be deployed and sending data to the backend

See the main [README](../README.md) for setup instructions.

---

## 2. Dashboard Overview

The dashboard is a single-page view with:

| Section | Location | Purpose |
|---------|----------|---------|
| Header | Top | App title and subtitle |
| Transformer selector | Below header | Choose which transformer to monitor |
| Live Readings card | Left (main area) | Real-time electrical and thermal metrics |
| Alerts card | Right sidebar | Recent alerts and acknowledgements |

On smaller screens, the layout stacks vertically: Live Readings first, then Alerts.

---

## 3. Selecting a Transformer

1. Use the **Transformer** dropdown.
2. Each option shows the transformer **name** and **serial** (or ID).
3. Choose the transformer you want to monitor.
4. The Live Readings and Alerts update for the selected transformer.

If the list is empty, no transformers exist in the system yet. Add them through the backend admin or API.

---

## 4. Live Readings

The **Live Readings** card shows six parameters and an overall condition badge.

| Parameter | Unit | Description |
|-----------|------|-------------|
| **Voltage** | V | Line voltage |
| **Current** | A | Line current |
| **Apparent Power** | VA | Apparent power |
| **Power Factor** | — | Power factor (0–1) |
| **Frequency** | Hz | Grid frequency |
| **Oil Temperature** | °C | Transformer oil temperature |

- Values update in real time when the WebSocket is connected.
- If there is no connection, the last HTTP reading is shown.
- `--` means the value is not available for that reading.

---

## 5. Understanding Condition Badges

The **condition badge** summarizes the transformer state based on thresholds (Table 3.1).

### Badge colors

| Color | Meaning | Examples |
|-------|---------|----------|
| **Normal** (gray/green) | Within safe limits | Normal |
| **Warning** (yellow/amber) | Elevated risk | Heavy Load, Heavy Peak Load, Overload, Poor Power Quality |
| **Critical** (red) | Requires attention | Danger Zone, Severe Overload, Abnormal, Critical |

### Condition labels

| Label | Meaning |
|-------|---------|
| **Normal** | All parameters within safe ranges |
| **Heavy Load** | Apparent power 100–125% of rated |
| **Heavy Peak Load** | Oil temp 75–90°C (heavy peak) |
| **Overload** | Current 100–125% of rated |
| **Severe Overload** | Current or apparent power >125% |
| **Danger Zone** | Oil temp >95°C |
| **Abnormal** | Voltage or frequency outside thresholds |
| **Poor Power Quality** | Power factor 0.70–0.85 |
| **Critical** | Power factor <0.70 or other critical limits |

---

## 6. Alerts

The **Alerts** card lists recent alerts for the selected transformer.

### Viewing alerts

Each alert shows:

- **Condition badge** — severity (normal/warning/critical)
- **Timestamp** — when the alert was created
- **Message** — details about the condition

### Acknowledging alerts

- Unacknowledged alerts have an **Acknowledge** button.
- Click **Acknowledge** to mark the alert as handled.
- Acknowledged alerts remain visible but no longer show the button.

---

## 7. Live Connection Status

A **Live** indicator (green badge) next to the transformer selector means:

- The WebSocket is connected.
- Live Readings update in real time without refreshing.

If the indicator is missing:

- The page uses the last available HTTP reading.
- Readings do not update until the connection is restored or the page is refreshed.

The app attempts to reconnect automatically when the WebSocket closes.

---

## 8. Empty States & Troubleshooting

### No data yet

**Message:** *"No data yet. Connect an ESP32 or wait for readings."*

- No readings exist for the selected transformer.
- **Action:** Ensure the ESP32 is powered, connected to the network, and sending data to the backend. Check `config.h` for the correct backend URL and transformer ID.

### No alerts

**Message:** *"No alerts."*

- No alerts have been generated for this transformer.
- **Action:** None. This is expected when the transformer is healthy.

### No transformers in dropdown

- No transformers are registered.
- **Action:** Create transformers via the Django admin or API, then refresh the page.

### Live indicator not showing

- WebSocket cannot connect (e.g. Redis not running or wrong backend URL).
- **Action:** Ensure Redis is running and the frontend `.env` points to the correct backend (including WebSocket URL).

---

## 9. Display & Accessibility

- **Theme:** The app follows your system theme (light or dark).
- **Responsive layout:** Works on mobile, tablet, and desktop.
- **Layout:** On large screens, Live Readings take about two-thirds of the width and Alerts one-third. On smaller screens, sections stack vertically.

---

## Quick Reference

| Task | How to do it |
|------|--------------|
| Switch transformer | Use the Transformer dropdown |
| Interpret readings | Use Live Readings; values in red indicate issues |
| Check condition | Look at the condition badge (Normal / Warning / Critical) |
| Mark alert as handled | Click **Acknowledge** on the alert |
| Confirm live updates | Look for the green **Live** badge next to the dropdown |

For backend setup, API details, or firmware configuration, see the main [README](../README.md).
