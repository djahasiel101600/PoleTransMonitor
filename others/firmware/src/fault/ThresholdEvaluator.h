#ifndef THRESHOLD_EVALUATOR_H
#define THRESHOLD_EVALUATOR_H

// Condition strings matching backend CONDITION_CHOICES
#define COND_NORMAL "normal"
#define COND_HEAVY_PEAK_LOAD "heavy_peak_load"
#define COND_DANGER_ZONE "danger_zone"
#define COND_OVERLOAD "overload"
#define COND_SEVERE_OVERLOAD "severe_overload"
#define COND_HEAVY_LOAD "heavy_load"
#define COND_ABNORMAL "abnormal"
#define COND_POOR_POWER_QUALITY "poor_power_quality"
#define COND_CRITICAL "critical"

struct SensorData {
  float voltage;
  float current;
  float apparentPower;
  float powerFactor;
  float frequency;
  float oilTemp;
};

struct EvalParams {
  float nominalVoltage;
  float nominalFreq;
  float ratedCurrent;
  float ratedApparentPower;
};

class ThresholdEvaluator {
 public:
  void setParams(const EvalParams& params) { params_ = params; }
  const char* evaluate(const SensorData& data);

 private:
  EvalParams params_;
};

#endif
