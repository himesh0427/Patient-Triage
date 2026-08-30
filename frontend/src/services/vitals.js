export const VITAL_LIMITS = {
  hr:   { min: 20,  max: 250, label: 'Heart Rate',   unit: 'bpm',   step: 1 },
  sbp:  { min: 50,  max: 300, label: 'Systolic BP',  unit: 'mmHg',  step: 1 },
  dbp:  { min: 20,  max: 200, label: 'Diastolic BP', unit: 'mmHg',  step: 1 },
  rr:   { min: 4,   max: 80,  label: 'Respiratory Rate', unit: '/min', step: 1 },
  temp: { min: 25,  max: 45,  label: 'Temperature',  unit: '°C',    step: 0.1 },
  spo2: { min: 50,  max: 100, label: 'SpO₂',         unit: '%',     step: 1 },
};

export const VITAL_KEYS = Object.keys(VITAL_LIMITS);

export function parseVital(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (str === '') return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export function sanitizeVitalInput(raw) {
  const str = String(raw ?? '').replace(/[^\d.]/g, '');
  const firstDot = str.indexOf('.');
  if (firstDot === -1) return str;
  return str.slice(0, firstDot + 1) + str.slice(firstDot + 1).replace(/\./g, '');
}

export function validateVital(code, value) {
  const meta = VITAL_LIMITS[code];
  if (!meta) return null;
  const num = parseVital(value);
  if (num === null) return null;
  if (num < meta.min) return `${meta.label} must be ${meta.min}–${meta.max} ${meta.unit}`;
  if (num > meta.max) return `${meta.label} must be ${meta.min}–${meta.max} ${meta.unit}`;
  return null;
}

export function validateAllVitals(vitals) {
  const errors = {};
  for (const code of VITAL_KEYS) {
    const err = validateVital(code, vitals?.[code]);
    if (err) errors[code] = err;
  }
  return errors;
}

const VITAL_WARNINGS = {
  hr:   { low: 50,  high: 120, label: 'Heart Rate',   unit: 'bpm' },
  sbp:  { low: 90,  high: 160, label: 'Systolic BP',  unit: 'mmHg' },
  dbp:  { low: 60,  high: 100, label: 'Diastolic BP', unit: 'mmHg' },
  rr:   { low: 10,  high: 24,  label: 'Respiratory Rate', unit: '/min' },
  temp: { low: 36,  high: 38,  label: 'Temperature',  unit: '°C' },
  spo2: { low: 95,  high: 100, label: 'SpO₂',         unit: '%' },
};

export function warnVital(code, value) {
  const w = VITAL_WARNINGS[code];
  if (!w) return null;
  const num = parseVital(value);
  if (num === null) return null;
  if (num < w.low) return `⚠ ${w.label} ${num} ${w.unit} is below the typical range (${w.low}–${w.high} ${w.unit}).`;
  if (num > w.high) return `⚠ ${w.label} ${num} ${w.unit} is above the typical range (${w.low}–${w.high} ${w.unit}).`;
  return null;
}
