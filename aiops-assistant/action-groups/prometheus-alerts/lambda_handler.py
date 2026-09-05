"""
Prometheus Alerts Lambda — PatientTriage.ai AIOps Action Group

Handles Bedrock Agent tool-use calls for querying Prometheus alert state
and metric values. READ-ONLY. Queries Prometheus HTTP API via the internal
Kubernetes service DNS name.

Prometheus endpoint is configurable via PROMETHEUS_URL environment variable.
Default: http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090
"""

import json
import os
import time
from datetime import datetime, timezone
from typing import Any
from urllib.request import urlopen, Request
from urllib.parse import urlencode, quote
from urllib.error import URLError

PROMETHEUS_URL = os.environ.get(
    "PROMETHEUS_URL",
    "http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090"
)

TRIAGE_NAMESPACE = "patient-triage"


def _prom_get(path: str, params: dict | None = None) -> dict:
    """Make a GET request to the Prometheus HTTP API."""
    url = f"{PROMETHEUS_URL}{path}"
    if params:
        url += "?" + urlencode(params)

    req = Request(url, headers={"Accept": "application/json"})
    try:
        with urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except URLError as exc:
        return {"error": str(exc), "status": "error"}


def get_active_alerts(severity_filter: str = "all") -> dict:
    """Query Prometheus /api/v1/alerts for FIRING alerts in patient-triage."""
    response = _prom_get("/api/v1/alerts")

    if response.get("status") != "success":
        return {
            "error": response.get("error", "Unknown Prometheus error"),
            "total_firing": 0,
            "critical_count": 0,
            "warning_count": 0,
            "alerts": [],
        }

    all_alerts = response.get("data", {}).get("alerts", [])

    # Filter to patient-triage namespace and FIRING state
    relevant = [
        a for a in all_alerts
        if a.get("state") == "firing"
        and a.get("labels", {}).get("namespace", "") in (TRIAGE_NAMESPACE, "")
    ]

    if severity_filter != "all":
        relevant = [
            a for a in relevant
            if a.get("labels", {}).get("severity") == severity_filter
        ]

    formatted_alerts = []
    critical_count = 0
    warning_count = 0

    for alert in relevant:
        labels = alert.get("labels", {})
        annotations = alert.get("annotations", {})
        severity = labels.get("severity", "unknown")

        if severity == "critical":
            critical_count += 1
        elif severity == "warning":
            warning_count += 1

        formatted_alerts.append({
            "name": labels.get("alertname", "Unknown"),
            "severity": severity,
            "state": alert.get("state"),
            "domain": labels.get("domain", "infra"),
            "summary": annotations.get("summary", ""),
            "description": annotations.get("description", ""),
            "runbook": annotations.get("runbook", ""),
            "firing_since": alert.get("activeAt", ""),
        })

    # Sort: critical first, then by name
    formatted_alerts.sort(
        key=lambda a: (0 if a["severity"] == "critical" else 1, a["name"])
    )

    return {
        "total_firing": len(formatted_alerts),
        "critical_count": critical_count,
        "warning_count": warning_count,
        "alerts": formatted_alerts,
        "queried_at": datetime.now(timezone.utc).isoformat(),
    }


def get_metric_value(metric_name: str, label_filters: str = "") -> dict:
    """Query the current value of a Prometheus metric."""
    query = metric_name + label_filters if label_filters else metric_name

    response = _prom_get("/api/v1/query", {"query": query})

    if response.get("status") != "success":
        return {
            "metric_name": metric_name,
            "error": response.get("error", "Unknown error"),
            "value": None,
        }

    results = response.get("data", {}).get("result", [])
    if not results:
        return {
            "metric_name": metric_name,
            "value": None,
            "note": "No data points found — metric may not exist or have no samples",
        }

    # Return first result (most metrics will be a single scalar)
    first = results[0]
    timestamp, value = first.get("value", [None, None])

    return {
        "metric_name": metric_name,
        "value": float(value) if value is not None else None,
        "labels": first.get("metric", {}),
        "timestamp": datetime.fromtimestamp(float(timestamp or 0), tz=timezone.utc).isoformat() if timestamp else None,
        "all_results": [
            {
                "labels": r.get("metric", {}),
                "value": float(r["value"][1]) if r.get("value") else None,
            }
            for r in results[:10]  # Cap at 10 results
        ],
    }


# ── Lambda handler ─────────────────────────────────────────────────────────────

ACTION_HANDLERS = {
    "get_active_alerts": get_active_alerts,
    "get_metric_value": get_metric_value,
}


def lambda_handler(event: dict, context: Any) -> dict:
    """Bedrock Agent action group Lambda handler — Prometheus alerts."""
    action_group = event.get("actionGroup", "")
    function_name = event.get("function", "")
    parameters = event.get("parameters", [])

    kwargs: dict = {}
    for param in parameters:
        name = param.get("name")
        value = param.get("value")
        param_type = param.get("type", "string")
        if param_type == "integer":
            kwargs[name] = int(value)
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
