import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

function useCountdown(deadlineIso) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadlineIso) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadlineIso]);

  if (!deadlineIso) return { remaining: null, overdue: false };
  const deadline = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadline)) return { remaining: null, overdue: false };

  const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
  return { remaining, overdue: now > deadline };
}

export function formatCountdown(sec) {
  if (sec === null || sec === undefined) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function ReassessmentTimer({
  deadlineIso,
  esiLevel,
  compact = false,
  showAlert = true,
}) {
  const { remaining, overdue } = useCountdown(deadlineIso);

  if (Number(esiLevel) === 1) {
    return (
      <span className="status-pill" style={{ background: '#fee2e2', color: '#991b1b', fontSize: compact ? '0.68rem' : '0.75rem' }}>
        <AlertTriangle size={12} /> Immediate Care
      </span>
    );
  }

  if (remaining === null) {
    return (
      <span style={{ fontSize: compact ? '0.72rem' : '0.8rem', color: 'var(--text-muted)' }}>
        —:—
      </span>
    );
  }

  if (overdue) {
    return (
      <span className="status-pill" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', fontSize: compact ? '0.68rem' : '0.78rem', fontWeight: 700 }}>
        <AlertTriangle size={12} /> {showAlert ? 'REASSESSMENT DUE' : 'Overdue'}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono)', fontSize: compact ? '0.75rem' : '0.88rem', fontWeight: 700, color: 'var(--text-title)' }}>
      <Clock size={13} style={{ color: 'var(--text-muted)' }} />
      {formatCountdown(remaining)}
    </span>
  );
}
