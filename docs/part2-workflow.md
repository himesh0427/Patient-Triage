# Part 2 — Dev → CI → CD → Prod → AIOps: The Complete Workflow

## Overview

```
Developer laptop
      │  git push → devops/my-feature
      │
      ▼
GitHub Actions CI (ci.yml)
  ├── lint-backend (ruff)
  ├── test-backend (pytest)
  ├── lint-frontend (oxlint + vite build)
  ├── build-backend → ECR: sha-<SHA>
  ├── build-frontend → ECR: sha-<SHA>
  └── trivy scan (CRITICAL = fail)
      │
      ▼
Merge to main
      │
      ▼
GitHub Actions CD (cd.yml)
  └── kustomize edit set image → commit to gitops/kustomization.yaml
      │
      ▼
ArgoCD (automated sync, 3m poll)
  └── detects diff in gitops/ → kubectl apply
      │
      ▼
Kubernetes (patient-triage namespace)
  ├── backend: RollingUpdate (0 downtime)
  └── frontend: RollingUpdate (0 downtime)
      │
      ▼
Prometheus + Grafana (continuous)
      │
      ▼
AIOps Bedrock Agent (every 15 min)
  └── EventBridge → Bedrock → CloudWatch + Prometheus → anomaly report
```

---

## Step 0: Local Development

```bash
# Run the full stack locally with Docker Compose
docker compose up --build

# Backend API:   http://localhost:8000
# API docs:      http://localhost:8000/docs
# Frontend:      http://localhost:80
# Metrics:       http://localhost:8000/metrics

# Run backend tests
cd backend && pip install -r requirements.txt pytest httpx
DATABASE_URL=sqlite:///./test.db python -m pytest test_20_patients.py -v

# Run frontend dev server (hot reload)
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

The Docker Compose stack uses a named volume for SQLite persistence — stopping and restarting with `docker compose up` retains all patient data.

---

## Step 1: Developer → GitHub

```bash
# Work on a feature or infra change
git checkout -b devops/add-prometheus-metrics
# ... make changes ...

# Commit and push
git push origin devops/add-prometheus-metrics

# Open a PR → CI runs automatically on the PR branch
# CI will: lint, test, build (but NOT push to ECR on PRs), scan
```

The CI workflow runs on all pushes to `devops/**`, `feature/**`, and PRs to `main`. Image pushes to ECR only happen on `main` branch and `workflow_dispatch`.

---

## Step 2: CI Pipeline (ci.yml)

### Jobs that run on PRs and pushes:

| Job | What it does | Failure behaviour |
|-----|-------------|-------------------|
| `lint-backend` | `ruff check app/` | Blocks merge |
| `test-backend` | `pytest test_20_patients.py` | Non-fatal (informational) |
| `lint-frontend` | `oxlint + npm run build` | Blocks merge |

### Jobs that run only on `main` (not PRs):

| Job | What it does | Failure behaviour |
|-----|-------------|-------------------|
| `build-backend` | `docker build && push to ECR` | Blocks CD |
| `build-frontend` | `docker build && push to ECR` | Blocks CD |
| `scan` | Trivy CRITICAL scan | Blocks CD |

**OIDC Authentication**: CI uses `aws-actions/configure-aws-credentials` with the GitHub OIDC provider. No AWS credentials are stored in GitHub Secrets — the IAM role trust policy restricts access to `repo:YOUR_ORG/Patient-Triage:*`.

Required GitHub Secrets:
- `AWS_GITHUB_ACTIONS_ROLE_ARN` — from `terraform output github_actions_role_arn`
- `ECR_BACKEND_URL` — from `terraform output ecr_backend_url`
- `ECR_FRONTEND_URL` — from `terraform output ecr_frontend_url`

---

## Step 3: CD Pipeline (cd.yml)

Triggered automatically when CI succeeds on `main`.

```bash
# What the CD pipeline does:
kustomize edit set image \
  "...patient-triage/backend=<ECR_URL>:sha-<SHA>"

kustomize edit set image \
  "...patient-triage/frontend=<ECR_URL>:sha-<SHA>"

git commit -m "chore(cd): deploy sha-<SHA>"
git push origin main
```

This creates a commit in `gitops/kustomization.yaml` that updates the two image references. ArgoCD detects this commit on its next poll (default: 3 minutes) and begins syncing the cluster.

---

## Step 4: ArgoCD Sync

ArgoCD continuously polls `gitops/` on the `main` branch. When it detects a change:

1. Runs `kustomize build gitops/` to generate the full manifest set
2. Diffs against the current cluster state
3. Applies only the changed resources
4. Backend deployment: `RollingUpdate` (maxUnavailable: 0, maxSurge: 1) → zero-downtime
5. Frontend deployment: `RollingUpdate` (maxUnavailable: 0, maxSurge: 1) → zero-downtime
6. PDB ensures at least 1 pod of each service is always running during the rollout

**If ArgoCD detects drift** (someone manually patched the cluster), it automatically reverts to the git state (`selfHeal: true`). This is intentional: the git repo is the source of truth.

---

## Step 5: Monitoring (Prometheus + Grafana)

After deployment, Prometheus scrapes the backend `/metrics` endpoint every 15 seconds.

### Key metrics visible in Grafana:

| Panel | Metric | Alert threshold |
|-------|--------|----------------|
| Escalation Rate | `triage_escalation_total` | 0 for >20min during hours 6-22 |
| Override Rate | `triage_override_total` | >3× 1h moving average |
| Audit Failures | `triage_audit_write_errors_total` | Any non-zero (P1) |
| Intake Latency (p95) | `triage_predict_duration_seconds` | >2s for >5min |
| Reassess Latency (p95) | `triage_revitals_duration_seconds` | >3s for >5min |
| Active Queue Depth | `triage_active_queue_size` | Visual only |
| Surge Mode | `triage_surge_mode_active` | Visual only |

### Accessing Grafana locally (after EKS deploy):

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
# → http://localhost:3000 (admin / changeme-use-sealed-secret)
```

---

## Step 6: AIOps Bedrock Agent (every 15 minutes)

The EventBridge Scheduler fires every 15 minutes during hospital hours (06:00–24:00 IST).

**What happens:**

1. Bedrock Agent receives the prompt: _"Analyse the last 30 minutes of triage operations..."_
2. Agent decides which tools to call (tool-use / function calling):
   - `query_escalation_rate(lookback_minutes=30)` → CloudWatch Logs Insights
   - `query_override_rate(lookback_minutes=30)` → CloudWatch Logs Insights
   - `query_audit_failures(lookback_minutes=15)` → CloudWatch Logs Insights
   - `query_api_latency(lookback_minutes=15)` → CloudWatch Metrics
   - `get_active_alerts()` → Prometheus HTTP API
3. Agent synthesises results into a structured report
4. Report is written to CloudWatch Logs `/patient-triage/aiops-reports`

**Example report output:**
```
STATUS: DEGRADED

[HIGH] Escalation Rate Anomaly
  Signal: Zero AUTO_ESCALATE events in 25 minutes (6am–10pm active hours)
  Prior 24h hourly average: 3.2 escalations/hour
  Recommended action: Check /triage/predict confidence_score distribution.
  Verify backend pod is running: kubectl get pods -n patient-triage.

[LOW] No override rate anomaly (current: 1.2×)
[OK] Audit log write failures: 0
[OK] Intake latency p95: 340ms (threshold: 2000ms)
[OK] Reassessment latency p95: 480ms (threshold: 3000ms)
```

---

## Operational Runbooks

### Rollback a bad deploy

```bash
# Check ArgoCD history
argocd app history patient-triage

# Rollback to previous revision
argocd app rollback patient-triage <revision-id>

# Or: revert the CD commit and push
git revert HEAD --no-edit
git push origin main
# ArgoCD auto-syncs to the previous image tag
```

### Manual trigger of AIOps analysis

```bash
aws bedrock-agent-runtime invoke-agent \
  --agent-id $(cd aiops-assistant/terraform && terraform output -raw agent_id) \
  --agent-alias-id $(cd aiops-assistant/terraform && terraform output -raw agent_alias_id) \
  --session-id manual-$(date +%s) \
  --input-text "Full triage system analysis — last 60 minutes." \
  output.json
```

### Check audit log integrity

```bash
# Direct database query (never in production; for dev only)
kubectl exec -n patient-triage deployment/backend -- \
  python3 -c "
from app.database import SessionLocal
from app.models import AuditLog
db = SessionLocal()
recent = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(10).all()
for log in recent:
    print(log.timestamp, log.action, log.user_id)
db.close()
"
```
