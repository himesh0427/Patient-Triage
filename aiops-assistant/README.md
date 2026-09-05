# AIOps Assistant — PatientTriage.ai

## What this is

A **triage-domain-specific** AWS Bedrock Agent that monitors the PatientTriage.ai system for operational anomalies. This is **not** a generic log summarizer — it watches the four signals that matter most for a safety-first ED triage system.

---

## Architecture

```
EventBridge (15-min schedule)
        │
        ▼
Bedrock Agent
(Claude Haiku)
        │
    ┌───┴────────────────────────────────────────────┐
    │  Tool-use via Lambda Action Groups             │
    │                                                │
    │  ┌─────────────────────────────────────────┐   │
    │  │ cloudwatch-queries Lambda               │   │
    │  │  - query_escalation_rate()              │   │
    │  │  - query_override_rate()                │   │
    │  │  - query_audit_failures()               │   │
    │  │  - query_api_latency()                  │   │
    │  └───────────────────────┬─────────────────┘   │
    │                          │                     │
    │  ┌────────────────────────▼────────────────┐   │
    │  │ prometheus-alerts Lambda                │   │
    │  │  - get_active_alerts()                  │   │
    │  │  - get_metric_value()                   │   │
    │  └─────────────────────────────────────────┘   │
    └────────────────────────────────────────────────┘
        │
        ▼
  Structured Report → CloudWatch Logs + SNS
```

---

## Watched Signals

| Signal | Why it matters | Alert condition |
|--------|---------------|-----------------|
| **Escalation rate** | Drop to near-zero = confidence scoring silently broke | Zero escalations for > 20min during hours 6–22 |
| **Override rate** | Spike = AI miscalibration, not just a UX metric | > 3× 1h moving average |
| **Audit write failures** | Compliance requires 100% coverage | Any non-zero count (P1) |
| **Triage intake latency** | `/triage/predict` on critical path | p95 > 2s for 5min |
| **Reassessment latency** | `/triage/revitals` critical during surge | p95 > 3s for 5min |
| **Pod crash loops** | Standard infra, still needed | > 2 restarts in 15min |
| **Node pressure** | Resource headroom for surge events | Memory > 85% for 10min |

---

## Deploying

```bash
# 1. Initialize and review the Terraform plan
cd aiops-assistant/terraform
terraform init
terraform plan -out=aiops.tfplan

# 2. Review the plan output — it will create:
#    - Bedrock Agent + Agent Alias
#    - 2 Lambda functions (cloudwatch-queries, prometheus-alerts)
#    - IAM roles (least privilege)
#    - EventBridge rule (15-min schedule during hospital hours)

# 3. Apply (confirm explicitly)
terraform apply aiops.tfplan
```

---

## Testing the Agent

```bash
# Test via AWS CLI (read-only — safe, no infra mutations)
aws bedrock-agent-runtime invoke-agent \
  --agent-id $(terraform output -raw agent_id) \
  --agent-alias-id $(terraform output -raw agent_alias_id) \
  --session-id test-$(date +%s) \
  --input-text "Analyse the last 30 minutes of triage operations and flag any anomalies." \
  --cli-binary-format raw-in-base64-out \
  output.json

cat output.json | jq -r '.completion'
```

---

## Customising Alert Thresholds

Edit `alert-rules/triage-alerts.yaml` for Prometheus alert thresholds.

The Bedrock Agent's own reasoning (when to flag vs. not flag) is configured in `agent-definition.json` under the `instruction` field. Update the Bedrock Agent via `terraform apply` after changing it.

---

## Safety boundary

The AIOps agent has **read-only** access to CloudWatch and Prometheus. It cannot:
- Modify triage decisions
- Change ESI levels or confidence thresholds
- Trigger patient actions
- Modify any database records

All it can do is query metrics/logs and produce a structured anomaly report.
