"""
CloudWatch Queries Lambda — PatientTriage.ai AIOps Action Group

Handles Bedrock Agent tool-use calls for triage-specific CloudWatch queries.
All actions are READ-ONLY: no mutations to logs, metrics, or application state.

Signals monitored:
  1. query_escalation_rate  — confidence-driven severity bumps
  2. query_override_rate    — clinician AI disagreements
  3. query_audit_failures   — compliance P1 signal
  4. query_api_latency      — critical path latency for triage/predict + triage/revitals
"""

import json
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Any

import boto3

LOGS_INSIGHTS = boto3.client("logs")
CLOUDWATCH = boto3.client("cloudwatch")

LOG_GROUP = os.environ.get("BACKEND_LOG_GROUP", "/patient-triage/backend")
NAMESPACE = "PatientTriage/Triage"
COMPLIANCE_NAMESPACE = "PatientTriage/Compliance"

INTAKE_LATENCY_THRESHOLD_MS = int(os.environ.get("INTAKE_LATENCY_THRESHOLD_MS", "2000"))
REVITALS_LATENCY_THRESHOLD_MS = int(os.environ.get("REVITALS_LATENCY_THRESHOLD_MS", "3000"))


def _now_epoch() -> int:
    return int(time.time())


def _ago_epoch(minutes: int) -> int:
    return _now_epoch() - (minutes * 60)


def _run_insights_query(query: str, start_time: int, end_time: int) -> list[dict]:
    """Run a CloudWatch Logs Insights query and poll until complete."""
    response = LOGS_INSIGHTS.start_query(
        logGroupName=LOG_GROUP,
        startTime=start_time,
        endTime=end_time,
        queryString=query,
        limit=1000,
    )
    query_id = response["queryId"]

    # Poll (max 30s)
    for _ in range(30):
        time.sleep(1)
        status = LOGS_INSIGHTS.get_query_results(queryId=query_id)
        if status["status"] in ("Complete", "Failed", "Cancelled"):
            return status.get("results", [])

    return []


def query_escalation_rate(lookback_minutes: int = 30) -> dict:
    """Count AUTO_ESCALATE_SURGE audit events in the window."""
    end_time = _now_epoch()
    start_time = _ago_epoch(lookback_minutes)

    # Count escalation events in current window
    query = """
    fields @timestamp, action, @message
    | filter action = "AUTO_ESCALATE_SURGE"
    | stats count() as escalation_count by bin(1m)
    | sort @timestamp asc
    """
    results = _run_insights_query(query, start_time, end_time)
    escalation_count = sum(int(r[0]["value"]) for r in results if r)

    # Compare against 24h baseline via CloudWatch Metrics
    prior_24h_stats = CLOUDWATCH.get_metric_statistics(
        Namespace=NAMESPACE,
        MetricName="EscalationEventCount",
        StartTime=datetime.now(timezone.utc) - timedelta(hours=24),
        EndTime=datetime.now(timezone.utc),
        Period=3600,
        Statistics=["Sum"],
    )
    prior_datapoints = prior_24h_stats.get("Datapoints", [])
    prior_total = sum(d["Sum"] for d in prior_datapoints)
    prior_24h_hourly_avg = prior_total / 24 if prior_total else 0
    current_rate_per_hour = escalation_count / (lookback_minutes / 60)

    current_hour = datetime.now(timezone.utc).hour
    in_active_hours = 6 <= current_hour <= 22

    anomaly_detected = escalation_count == 0 and in_active_hours
    anomaly_reason = (
        f"Zero escalations in {lookback_minutes} minutes during active hospital hours "
        f"(hour {current_hour}). Prior 24h hourly average: {prior_24h_hourly_avg:.1f}. "
        "This may indicate the confidence-scoring escalation logic silently broke."
        if anomaly_detected else ""
    )

    return {
        "escalation_count": escalation_count,
        "window_minutes": lookback_minutes,
        "prior_24h_hourly_average": round(prior_24h_hourly_avg, 2),
        "current_rate_per_hour": round(current_rate_per_hour, 2),
        "in_active_hours": in_active_hours,
        "anomaly_detected": anomaly_detected,
        "anomaly_reason": anomaly_reason,
    }


def query_override_rate(lookback_minutes: int = 30, baseline_hours: int = 24) -> dict:
    """Count OVERRIDE audit events and compute rate vs. baseline."""
    end_time = _now_epoch()
    start_time = _ago_epoch(lookback_minutes)

    query = """
    fields @timestamp, action, old_value, new_value
    | filter action = "OVERRIDE"
    | stats count() as override_count, 
            count_distinct(case when new_value > old_value then 1 else 0 end) as escalated,
            count_distinct(case when new_value < old_value then 1 else 0 end) as deescalated
    """
    results = _run_insights_query(query, start_time, end_time)

    override_count = int(results[0][0]["value"]) if results and results[0] else 0
    escalations = int(results[0][1]["value"]) if results and results[0] else 0
    deescalations = int(results[0][2]["value"]) if results and results[0] else 0

    # Baseline from CloudWatch Metrics
    baseline_stats = CLOUDWATCH.get_metric_statistics(
        Namespace=NAMESPACE,
        MetricName="OverrideEventCount",
        StartTime=datetime.now(timezone.utc) - timedelta(hours=baseline_hours),
        EndTime=datetime.now(timezone.utc),
        Period=3600,
        Statistics=["Sum"],
    )
    baseline_total = sum(d["Sum"] for d in baseline_stats.get("Datapoints", []))
    baseline_per_hour = baseline_total / baseline_hours if baseline_total else 0
    current_per_hour = override_count / (lookback_minutes / 60)

    rate_multiplier = (current_per_hour / baseline_per_hour) if baseline_per_hour > 0 else 0
    anomaly_detected = rate_multiplier > 3.0

    return {
        "override_count": override_count,
        "override_escalations": escalations,
        "override_deescalations": deescalations,
        "baseline_rate_per_hour": round(baseline_per_hour, 2),
        "current_rate_per_hour": round(current_per_hour, 2),
        "rate_multiplier": round(rate_multiplier, 2),
        "anomaly_detected": anomaly_detected,
        "anomaly_reason": (
            f"Override rate is {rate_multiplier:.1f}x the {baseline_hours}h baseline. "
            "Clinicians may be consistently disagreeing with AI recommendations — "
            "possible model calibration drift."
            if anomaly_detected else ""
        ),
    }


def query_audit_failures(lookback_minutes: int = 15) -> dict:
    """Detect any audit log write failures — P1 compliance signal."""
    end_time = _now_epoch()
    start_time = _ago_epoch(lookback_minutes)

    query = """
    fields @timestamp, @message
    | filter @message like /audit_write_error/
    | sort @timestamp asc
    | limit 10
    """
    results = _run_insights_query(query, start_time, end_time)

    failure_count = len(results)
    first_occurrence = None
    last_occurrence = None
    sample_error = None

    if results:
        timestamps = []
        for row in results:
            for field in row:
                if field.get("field") == "@timestamp":
                    timestamps.append(field["value"])
                if field.get("field") == "@message" and sample_error is None:
                    sample_error = field["value"][:200]

        if timestamps:
            first_occurrence = timestamps[0]
            last_occurrence = timestamps[-1]

    return {
        "failure_count": failure_count,
        "window_minutes": lookback_minutes,
        "first_occurrence": first_occurrence,
        "last_occurrence": last_occurrence,
        "sample_error": sample_error,
        "is_p1_incident": failure_count > 0,
        "compliance_note": (
            "CRITICAL: Every triage recommendation and clinician decision must be "
            "durably logged. Audit write failures create gaps in the compliance record."
            if failure_count > 0 else "No audit write failures detected."
        ),
    }


def query_api_latency(lookback_minutes: int = 15) -> dict:
    """Query p50/p95/p99 latency for the two critical triage endpoints."""
    end_time = _now_epoch()
    start_time = _ago_epoch(lookback_minutes)

    def _latency_for_path(path_pattern: str) -> dict:
        query = f"""
        fields @timestamp, @duration
        | filter @message like /{path_pattern}/
        | stats 
            pct(@duration, 50) as p50,
            pct(@duration, 95) as p95,
            pct(@duration, 99) as p99,
            count() as request_count
        """
        results = _run_insights_query(query, start_time, end_time)
        if not results or not results[0]:
            return {"p50_ms": None, "p95_ms": None, "p99_ms": None, "request_count": 0}

        vals = {f["field"]: float(f["value"] or 0) for f in results[0]}
        return {
            "p50_ms": round(vals.get("p50", 0) * 1000, 1),
            "p95_ms": round(vals.get("p95", 0) * 1000, 1),
            "p99_ms": round(vals.get("p99", 0) * 1000, 1),
            "request_count": int(vals.get("request_count", 0)),
        }

    predict_stats = _latency_for_path("triage/predict")
    revitals_stats = _latency_for_path("triage/revitals")

    # Check surge mode from metrics
    surge_metric = CLOUDWATCH.get_metric_statistics(
        Namespace=NAMESPACE,
        MetricName="SurgeModeActive",
        StartTime=datetime.now(timezone.utc) - timedelta(minutes=5),
        EndTime=datetime.now(timezone.utc),
        Period=300,
        Statistics=["Maximum"],
    )
    surge_active = any(d["Maximum"] == 1.0 for d in surge_metric.get("Datapoints", []))

    predict_p95 = predict_stats.get("p95_ms") or 0
    revitals_p95 = revitals_stats.get("p95_ms") or 0

    predict_stats["above_threshold"] = predict_p95 > INTAKE_LATENCY_THRESHOLD_MS
    predict_stats["threshold_ms"] = INTAKE_LATENCY_THRESHOLD_MS
    revitals_stats["above_threshold"] = revitals_p95 > REVITALS_LATENCY_THRESHOLD_MS
    revitals_stats["threshold_ms"] = REVITALS_LATENCY_THRESHOLD_MS

    return {
        "triage_predict": predict_stats,
        "triage_revitals": revitals_stats,
        "surge_mode_active": surge_active,
        "context": (
            "Surge mode is ACTIVE — reassessment latency is especially critical now."
            if surge_active else ""
        ),
    }


# ── Lambda handler ─────────────────────────────────────────────────────────────

ACTION_HANDLERS = {
    "query_escalation_rate": query_escalation_rate,
    "query_override_rate": query_override_rate,
    "query_audit_failures": query_audit_failures,
    "query_api_latency": query_api_latency,
}


def lambda_handler(event: dict, context: Any) -> dict:
    """
    Bedrock Agent action group Lambda handler.
    
    Event format:
        {
          "actionGroup": "cloudwatch-queries",
          "function": "query_escalation_rate",
          "parameters": [{"name": "lookback_minutes", "type": "integer", "value": "30"}]
        }
    """
    action_group = event.get("actionGroup", "")
    function_name = event.get("function", "")
    parameters = event.get("parameters", [])

    # Parse parameters list → kwargs dict
    kwargs: dict = {}
    for param in parameters:
        name = param.get("name")
        value = param.get("value")
        param_type = param.get("type", "string")
        if param_type == "integer":
            kwargs[name] = int(value)
        elif param_type == "number":
            kwargs[name] = float(value)
        elif param_type == "boolean":
            kwargs[name] = value.lower() == "true"
        else:
            kwargs[name] = value

    handler = ACTION_HANDLERS.get(function_name)
    if not handler:
        return {
            "actionGroup": action_group,
            "function": function_name,
            "functionResponse": {
                "responseBody": {
                    "TEXT": {"body": json.dumps({"error": f"Unknown function: {function_name}"})}
                }
            },
        }

    try:
        result = handler(**kwargs)
        body = json.dumps(result, default=str)
    except Exception as exc:
        body = json.dumps({"error": str(exc), "function": function_name})

    return {
        "actionGroup": action_group,
        "function": function_name,
        "functionResponse": {
            "responseBody": {
                "TEXT": {"body": body}
            }
        },
    }
