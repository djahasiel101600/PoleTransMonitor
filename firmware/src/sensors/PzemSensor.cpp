#include "PzemSensor.h"
#include <PZEM004Tv30.h>

static PZEM004Tv30* pzem = nullptr;

void PzemSensor::begin(int rxPin, int txPin) {
  rxPin_ = rxPin;
  txPin_ = txPin;
  if (!pzem) {
    pzem = new PZEM004Tv30(Serial2, rxPin, txPin);
  }
  pzem->resetEnergy();
  initialized_ = true;
}

bool PzemSensor::read(PzemReading& out) {
  if (!initialized_ || !pzem) {
    out.valid = false;
    return false;
  }
  out.voltage = pzem->voltage();
  out.current = pzem->current();
  out.power = pzem->power();
  out.energy = pzem->energy();
  out.powerFactor = pzem->pf();
  out.frequency = pzem->frequency();
  out.valid = !isnan(out.voltage) && out.voltage > 0;
  return out.valid;
}
