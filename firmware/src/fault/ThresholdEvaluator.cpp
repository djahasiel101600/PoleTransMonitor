#include "ThresholdEvaluator.h"
#include <math.h>
#include <string.h>
#include <algorithm>

const char* ThresholdEvaluator::evaluate(const SensorData& data) {
  const float& Vn = params_.nominalVoltage;
  const float& Fn = params_.nominalFreq;
  const float& In = params_.ratedCurrent;
  const float& Sn = params_.ratedApparentPower;

  const char* oilCond = COND_NORMAL;
  const char* voltCond = COND_NORMAL;
  const char* currCond = COND_NORMAL;
  const char* powerCond = COND_NORMAL;
  const char* freqCond = COND_NORMAL;
  const char* pfCond = COND_NORMAL;

  // Top-oil: 50-75°C Normal, 75-90°C Heavy Peak Load, >95°C Danger Zone
  if (!isnan(data.oilTemp)) {
    if (data.oilTemp > 95.0f) oilCond = COND_DANGER_ZONE;
    else if (data.oilTemp > 90.0f) oilCond = COND_DANGER_ZONE;  // 90-95 ambiguous; treat as danger
    else if (data.oilTemp > 75.0f) oilCond = COND_HEAVY_PEAK_LOAD;
  }

  // Voltage: ±10% Normal, outside ±10% Abnormal (utility standard allows ~±10%)
  if (!isnan(data.voltage) && Vn > 0) {
    float vPct = 100.0f * fabsf(data.voltage - Vn) / Vn;
    if (vPct > 10.0f) voltCond = COND_ABNORMAL;
  }

  // Current: ≤100% Normal, 100-125% Overload, >125% Severe Overload
  if (!isnan(data.current) && In > 0) {
    float iPct = 100.0f * data.current / In;
    if (iPct > 125.0f) currCond = COND_SEVERE_OVERLOAD;
    else if (iPct > 100.0f) currCond = COND_OVERLOAD;
  }

  // Apparent Power: ≤100% Normal, 100-125% Heavy Load, >125% Severe Overload
  if (!isnan(data.apparentPower) && Sn > 0) {
    float sPct = 100.0f * data.apparentPower / Sn;
    if (sPct > 125.0f) powerCond = COND_SEVERE_OVERLOAD;
    else if (sPct > 100.0f) powerCond = COND_HEAVY_LOAD;
  }

  // Frequency: ±1 Hz Normal, outside ±2 Hz Abnormal
  if (!isnan(data.frequency) && Fn > 0) {
    float fDelta = fabsf(data.frequency - Fn);
    if (fDelta > 2.0f) freqCond = COND_ABNORMAL;
  }

  // Power Factor: ≥0.85 Normal, 0.70-0.85 Poor, <0.70 Critical
  if (!isnan(data.powerFactor)) {
    if (data.powerFactor < 0.70f) pfCond = COND_CRITICAL;
    else if (data.powerFactor < 0.85f) pfCond = COND_POOR_POWER_QUALITY;
  }

  // Aggregate: return most severe
  auto severity = [](const char* c) -> int {
    if (!strcmp(c, COND_CRITICAL)) return 9;
    if (!strcmp(c, COND_DANGER_ZONE)) return 8;
    if (!strcmp(c, COND_SEVERE_OVERLOAD)) return 7;
    if (!strcmp(c, COND_ABNORMAL)) return 6;
    if (!strcmp(c, COND_OVERLOAD)) return 5;
    if (!strcmp(c, COND_HEAVY_LOAD)) return 5;
    if (!strcmp(c, COND_HEAVY_PEAK_LOAD)) return 4;
    if (!strcmp(c, COND_POOR_POWER_QUALITY)) return 3;
    return 0;
  };

  const char* worst = COND_NORMAL;
  int maxSev = 0;
  for (const char* c : {oilCond, voltCond, currCond, powerCond, freqCond, pfCond}) {
    int s = severity(c);
    if (s > maxSev) {
      maxSev = s;
      worst = c;
    }
  }
  return worst;
}
