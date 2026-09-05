# CLAUDE.md — PatientTriage.ai

This file is read automatically by Claude Code at the start of every session in this repo. It exists to put Claude in safe execution mode and to give it the project context it needs without re-explaining every time.

---

## What this project is

**PatientTriage.ai** is a safety-first ED triage decision-support prototype. It prioritizes and routes patients as they arrive/wait — it does not diagnose and does not replace clinical judgment. Every AI recommendation requires a clinician to accept or override it before the patient enters the queue.

### Current state (as of 2026-09-05)

- `backend/` — FastAPI app. SQLite via SQLAlchemy. LightGBM ordinal regression model (`app/ml/`), hard-rules safety gate (`app/ml/hard_rules.py`), full routers for auth, triage, override, patients, hospital_config.
- `frontend/` — React + Vite + Tailwind SPA. 16 pages. No plain HTML; this is a proper build-step app.
- `infra/terraform/` — VPC, EKS, ECR, IAM, CloudWatch. **IaC is written; nothing has been applied to AWS yet.**
- `gitops/` — Kubernetes manifests, Kustomize, ArgoCD Application. **Not yet deployed.**
- `.github/workflows/` — CI (lint/test/build/scan) + CD (kustomize update → ArgoCD sync). **Not yet triggered.**
- `aiops-assistant/` — Bedrock Agent with triage-specific alert rules and Lambda action groups. **Not yet deployed.**

---

## Why this matters for Claude's behavior

The triage engine is the safety-critical part of this repo. It makes recommendations about patient prioritization.

> **Never modify the following as a side effect of infrastructure work:**
> - `backend/app/ml/hard_rules.py` — deterministic ESI-1/ESI-2 safety gate
> - `backend/app/ml/model_loader.py` — LightGBM booster loading and `predict_esi()`
> - `backend/app/services/queue_manager.py` — retriage clock and surge auto-escalation
> - Any scoring logic, thresholds, or escalation rules anywhere in `backend/app/`

If a DevOps task seems to require touching any of the above (e.g. "add a health check that validates triage output"), **stop and ask first**.

---

## Safe execution mode — non-negotiable

**Explain what you're about to do and why**, before taking any action that touches:

- Live AWS infrastructure (`terraform apply`, `eksctl`, AWS CLI mutating calls)
- The Kubernetes cluster (`kubectl apply/delete`, Helm installs)
- CI/CD state (pushing to branches that trigger pipelines, editing workflow files that will run automatically)
- ArgoCD sync state (manual syncs, app deletions)

For anything **destructive or hard to reverse** (`terraform destroy`, `kubectl delete namespace`, force-pushes, deleting ArgoCD applications, EKS cluster teardown) — always ask for explicit confirmation first, **no exceptions**, even if a previous message implied it was fine.

**Read-only inspection** (`describe`, `get`, `logs`, `plan` without `apply`, cost estimates) does **not** need pre-approval — go ahead and gather that context proactively.

---

## MCP servers configured for this repo

Set these up in `~/.claude/settings.json` (same as devops-ai-playbook):

| Server | What it unlocks |
|--------|----------------|
| `awslabs.eks-mcp-server` | Query the EKS cluster, inspect pods, stream logs, apply manifests |
| `awslabs.terraform-mcp-server` | Run Terraform commands, search provider docs, run Checkov scans |
| `awslabs.aws-pricing-mcp-server` | Live AWS pricing lookups and cost analysis |
| `awslabs.core-mcp-server` | MCP orchestration layer |

**Skill**: `terraform-skill` — module patterns, testing strategy, security scanning, IaC-specific CI/CD conventions.

---

## Target repository structure

```
patient-triage/
├── CLAUDE.md                        ← this file
├── docs/
│   ├── part1-system-design.md       # architecture decisions
│   ├── part2-workflow.md            # dev → CI → CD → prod → AIOps flow
│   └── claude-setup.md              # this file, explained for humans
├── backend/                         # FastAPI app + Dockerfile
├── frontend/                        # React/Vite + Dockerfile (nginx)
├── infra/
│   └── terraform/                   # VPC, EKS, ECR, IAM, CloudWatch
├── gitops/
│   ├── argo-cd.yml
│   ├── kustomization.yaml
│   └── k8s/                         # Deployment/Service/Ingress/HPA/PDB
├── aiops-assistant/                 # Bedrock Agent — triage-specific AIOps
└── .github/
    └── workflows/
        ├── ci.yml                   # lint, test, build, push images
        └── cd.yml                   # update gitops manifests → ArgoCD
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Application | FastAPI (backend), React + Vite (frontend) |
| Containers | Docker, Docker Compose (local dev parity) |
| Orchestration | Kubernetes on AWS EKS |
| Infrastructure | Terraform |
| CI/CD | GitHub Actions |
| GitOps | ArgoCD + Kustomize |
| Monitoring | Prometheus + Grafana |
| Log Forwarding | AWS Fluent Bit → CloudWatch |
| AIOps | AWS Bedrock Agent (triage-specific) |
| AI Assistant | Claude Code + MCP servers |

---

## AIOps scope — triage-specific, not generic

The Bedrock AIOps agent watches for:

1. **Escalation-rate anomalies** — spike or drop in `%` of triage calls hitting the confidence-driven severity bump. A drop to near-zero = silent bug, not healthier patients.
2. **Override-rate anomalies** — clinicians overriding AI > 3× baseline = calibration signal.
3. **Audit-log write failures** — every recommendation must be logged; a gap is a P1.
4. **API latency on critical endpoints** — `/triage/predict` (intake) and `/triage/revitals/{id}` (reassessment) on the critical path during surge.
5. **Pod crash loops / EKS node pressure** — standard infra, still needed.

Agent wires tool-use into **CloudWatch Logs Insights** queries and **Prometheus alert rules**, not a generic log summarizer.

---

## One explicit boundary

This DevOps/AIOps buildout is a **separate concern** from the hackathon submission. Keep infra work on a `devops/*` branch. Don't let infra polish crowd out time that should go into the triage engine before a hackathon deadline.
