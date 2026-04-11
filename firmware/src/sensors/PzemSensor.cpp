#include "PzemSensor.h"
#include <PZEM004Tv30.h>
#include <cmath>

static PZEM004Tv30 *pzem = nullptr;

void PzemSensor::begin(int rxPin, int txPin)
{
  rxPin_ = rxPin;
  txPin_ = txPin;
  if (!pzem)
  {
    pzem = new PZEM004Tv30(Serial1, rxPin, txPin); // Serial1 so modem can use Serial2 (match a7670e_test)
  }
  initialized_ = true;
}

bool PzemSensor::read(PzemReading &out)
{
  if (!initialized_ || !pzem)
  {
    out.valid = false;
    return false;
  }
  out.voltage = pzem->voltage();
  out.current = pzem->current();
  out.power = pzem->power();
  out.energy = pzem->energy();
  out.powerFactor = pzem->pf();
  out.frequency = pzem->frequency();

  // Fallback: some PZEM-004T v3.0 units return 0 or NaN for PF; compute from P / (V*I)
  float apparent = out.voltage * out.current;
  if ((isnan(out.powerFactor) || out.powerFactor <= 0.0f) && !isnan(out.power) && !isnan(apparent) && apparent > 0.1f && out.power >= 0.0f)
  {
    float pf = out.power / apparent;
    if (pf > 1.0f)
      pf = 1.0f;
    if (pf < 0.0f)
      pf = 0.0f;
    out.powerFactor = pf;
  }

  out.valid = !isnan(out.voltage) && out.voltage > 0;
  return out.valid;
}

bool PzemSensor::resetEnergy()
{
  if (!initialized_ || !pzem)
    return false;
  return pzem->resetEnergy();
}
