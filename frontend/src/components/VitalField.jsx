import React from 'react';
import { VITAL_LIMITS, sanitizeVitalInput, validateVital, warnVital } from '../services/vitals';
import { AlertTriangle } from 'lucide-react';

export default function VitalField({ code, value, onChange, disabled }) {
  const meta = VITAL_LIMITS[code];
  if (!meta) return null;

  const err = validateVital(code, value);
  const warn = warnVital(code, value);

  return (
    <div className="form-group">
      <label className="form-label">
        {meta.label} ({meta.unit})
      </label>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`form-control ${err ? 'input-invalid' : ''}`}
        placeholder={`${meta.min}–${meta.max}`}
        value={value ?? ''}
        onChange={(e) => onChange(code, sanitizeVitalInput(e.target.value))}
        disabled={disabled}
      />
      {err ? (
        <div className="field-error">
          <AlertTriangle size={12} /> {err}
        </div>
      ) : warn ? (
        <div className="field-warning">{warn}</div>
      ) : null}
    </div>
  );
}
