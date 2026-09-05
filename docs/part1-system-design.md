# Part 1 — System Design: Why EKS + Terraform + ArgoCD for a 2-Service App

## The honest answer

PatientTriage.ai is a 2-service app (FastAPI backend + React frontend). A reasonable person would ask: why EKS, Terraform, and ArgoCD? Couldn't you just run this on a single EC2 instance with Docker Compose?

Yes. For production clinical traffic: absolutely not.

This document explains the architectural decisions — not to justify complexity for its own sake, but to explain why the complexity of this stack is the right choice for a system where the failure mode includes incorrect patient prioritization.

---

## Why not just Docker Compose on EC2?

| Concern | Docker Compose on EC2 | This stack (EKS) |
|---------|----------------------|------------------|
| Zero-downtime deploys | Requires custom scripting | RollingUpdate built in |
| Automatic restarts on crash | `restart: always` works | CrashLoopBackOff + PDB |
| Node failure recovery | Manual | EKS managed node group |
| Horizontal scaling during surge | Manual | HPA (ready to activate) |
| Audit log integrity under restart | Depends on volume setup | PVC + PDB guarantees |
| Compliance audit trail for infra changes | None | Terraform state + PR review |
| Secret management | `.env` files on disk | IRSA + AWS Secrets Manager |

The key constraint is the **audit log requirement**: every triage recommendation and clinician decision must be durably logged. A plain Docker restart on an EC2 instance during a patient surge is a gap in that audit trail. Kubernetes PodDisruptionBudgets + rolling updates provide the guarantee that at least one backend pod is always serving while another is being updated.

---

## VPC Design

```
10.0.0.0/16
├── Public subnets (10.0.0.0/24, 10.0.1.0/24)
│   ├── Internet Gateway
│   ├── NAT Gateway (single — saves ~$32/month)
│   └── ALB (Application Load Balancer)
└── Private subnets (10.0.10.0/24, 10.0.11.0/24)
    ├── EKS control plane
    ├── Worker nodes (t3.medium × 2)
    └── Pods (VPC CNI — pods get real VPC IPs)
```

**Single NAT Gateway**: A production deployment would use one NAT per AZ for fault isolation. For a portfolio project (not a funded deployment), the cost difference (~$65/month vs. ~$32/month) is not justified. The `infra/terraform/vpc.tf` comment documents this trade-off.

**EKS in private subnets**: The EKS control plane API has `endpoint_public_access = true` for initial setup convenience. In a hardened deployment, set this to `false` and access via a VPN or bastion host.

---

## Why Terraform (not CDK, Pulumi, or CloudFormation)?

- **Ecosystem breadth**: AWS, Kubernetes provider, Helm provider — all in one tool.
- **State management**: The `.tfstate` file captures the full resource graph. Drift detection via `terraform plan` before any change.
- **IaC review process**: Changes to `infra/terraform/` go through PRs. The CI/CD pipeline runs `terraform plan` on PRs (future enhancement) and `terraform apply` only on merge to main. No silent infra changes.
- **Checkov compatibility**: The `awslabs.terraform-mcp-server` MCP plugin runs Checkov security scans on Terraform HCL without leaving the editor.

---

## Why ArgoCD (not Flux, or just Helm in CI)?

ArgoCD provides **self-healing GitOps**: if someone manually patches a deployment in the cluster (e.g., in an emergency), ArgoCD detects the drift and reverts to the git-declared state within seconds. For a compliance-sensitive system, this is the behavior you want — the git repo is the single source of truth, not the cluster.

The alternative (Helm install in CI) means every deploy requires a successful CI run. ArgoCD means the cluster continuously converges toward whatever is in `gitops/` — even if CI is temporarily unavailable.

---

## SQLite in Kubernetes: The Trade-off

The current backend uses SQLite. This creates a constraint: only one pod can write to the database at a time. The k8s manifests address this by:

1. `replicas: 1` in `backend/deployment.yaml` (single writer)
2. `ReadWriteOnce` PVC (EBS volume — single-node mount)
3. HPA `maxReplicas: 1` (prevents autoscaler from creating a second writer)

**Migration path to PostgreSQL**: Change `DATABASE_URL` to `postgresql://...` in the backend ConfigMap, set `replicas: 2` in the deployment, and update HPA `maxReplicas: 6`. The SQLAlchemy ORM and all existing queries will work without code changes — the `create_engine` call in `database.py` already handles both dialects.

---

## Security Posture

| Control | Implementation |
|---------|---------------|
| No hardcoded AWS credentials | OIDC (GitHub Actions) + IRSA (k8s pods) |
| Secrets rotation | AWS Secrets Manager (future); currently ConfigMap |
| Container image scanning | ECR scan-on-push + Trivy in CI |
| Non-root containers | `runAsUser: 1001` (backend), `runAsUser: 101` (nginx) |
| Network isolation | Private subnets, ClusterIP services, ALB as sole ingress |
| Secrets encryption at rest | EKS secrets encrypted with KMS |
| Audit logging | VPC flow logs + EKS control plane logs + CloudWatch |

---

## Cost Estimate (us-east-1, as-built)

| Resource | Monthly estimate |
|----------|----------------|
| EKS control plane | $73 |
| 2× t3.medium nodes (On-Demand) | ~$60 |
| NAT Gateway (1× + data transfer) | ~$35 |
| ALB | ~$18 |
| ECR (2 repos, ~2GB storage) | ~$2 |
| CloudWatch Logs (30-day retention) | ~$3 |
| Bedrock Agent (Haiku, ~96 invocations/day) | ~$5 |
| EventBridge Scheduler | ~$0 |
| **Total** | **~$196/month** |

To reduce cost during development: set `node_desired_capacity = 1` and `use_spot_instances = true` in `infra/terraform/variables.tf`. This brings compute cost to ~$9/month at the cost of Spot interruption risk.
