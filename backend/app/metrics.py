"""
metrics.py — Custom Prometheus counters and gauges for PatientTriage.ai.

These metrics are triage-domain-specific:
  - escalation events (confidence-driven severity bumps)
  - clinician override events
  - audit write failures
  - active queue depth
  - low-confidence triage events

The /metrics endpoint is exposed by prometheus-fastapi-instrumentator
(wired in main.py). This module only defines the metric objects; they
are incremented by the routers and services that already handle these events.

NOTE: This file deliberately does NOT modify any scoring logic, thresholds,
or escalation rules. It only observes and counts events that already happen.
"""

from prometheus_client import Counter, Gauge, Histogram

# ── Triage-domain counters ─────────────────────────────────────────────────────

triage_escalation_total = Counter(
    name="triage_escalation_total",
    documentation=(
        "Total number of AUTO_ESCALATE events — triage calls where the "
        "confidence-driven safety rule bumped the patient to a higher ESI level. "
        "A sustained drop to 0 during active hours may indicate the confidence "
        "scoring logic silently broke."
    ),
    labelnames=["hospital_type", "surge_mode"],
)

triage_override_total = Counter(
    name="triage_override_total",
    documentation=(
        "Total number of clinician OVERRIDE events — cases where a nurse or "
        "physician disagreed with the AI recommendation. A spike vs. the rolling "
        "baseline is a calibration signal for the model."
    ),
    labelnames=["direction"],  # 'escalate' | 'de-escalate' | 'same'
)

triage_audit_write_errors_total = Counter(
    name="triage_audit_write_errors_total",
    documentation=(
        "Total number of audit log write failures. "
        "Any non-zero value is a P1 — compliance requires every recommendation "
        "and decision to be durably logged."
    ),
    labelnames=["endpoint"],
)

triage_low_confidence_total = Counter(
    name="triage_low_confidence_total",
    documentation=(
        "Total number of triage predictions that fell below the institutional "
        "confidence threshold (requires mandatory clinician review before "
        "accepting the ESI recommendation)."
    ),
    labelnames=["esi_predicted"],
)

triage_predictions_total = Counter(
    name="triage_predictions_total",
    documentation="Total number of triage predictions served (all outcomes).",
    labelnames=["esi_predicted", "hospital_type"],
)

triage_bypass_total = Counter(
    name="triage_bypass_total",
    documentation="Total number of critical-bypass triage entries (immediate ESI-1).",
)

triage_discharge_total = Counter(
    name="triage_discharge_total",
    documentation="Total number of patient discharges.",
    labelnames=["esi_final"],
)

# ── Gauges (instantaneous state) ──────────────────────────────────────────────

triage_active_queue_size = Gauge(
    name="triage_active_queue_size",
    documentation="Current number of patients in the active triage queue.",
    labelnames=["esi_level"],
)

triage_retriage_overdue_count = Gauge(
    name="triage_retriage_overdue_count",
    documentation=(
        "Current number of patients whose safe reassessment interval has elapsed "
        "and who have not yet been re-triaged."
    ),
)

triage_surge_mode_active = Gauge(
    name="triage_surge_mode_active",
    documentation="1 if 3× Surge Protocol is currently active, 0 otherwise.",
)

# ── Histograms (latency buckets) ───────────────────────────────────────────────
# These supplement the auto-instrumented HTTP latency from
# prometheus-fastapi-instrumentator, providing endpoint-specific buckets
# calibrated to triage's real-time decision latency requirements.

TRIAGE_LATENCY_BUCKETS = (0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0)

triage_predict_duration_seconds = Histogram(
    name="triage_predict_duration_seconds",
    documentation=(
        "Latency of POST /triage/predict (patient intake). "
        "This is on the critical path during a live triage decision. "
        "Alert threshold: p95 > 2s."
    ),
    buckets=TRIAGE_LATENCY_BUCKETS,
)

triage_revitals_duration_seconds = Histogram(
    name="triage_revitals_duration_seconds",
    documentation=(
        "Latency of POST /triage/revitals/{visit_id} (reassessment). "
        "This is on the critical path during a surge event. "
        "Alert threshold: p95 > 3s."
    ),
    buckets=TRIAGE_LATENCY_BUCKETS,
)
