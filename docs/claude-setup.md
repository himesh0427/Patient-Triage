# CLAUDE.md — Explained (For Humans)

This document explains the CLAUDE.md file at the repo root. CLAUDE.md is a session primer — it's read automatically by Claude Code at the start of every session in this repo.

---

## Why CLAUDE.md exists

Claude Code (and similar AI coding assistants) start each session without memory of previous sessions. Without a primer file, you'd have to re-explain the project context every time:
- What the app does
- Which files are safety-critical and must not be touched
- What rules govern the AI's behaviour in this repo
- What MCP servers are available

CLAUDE.md solves this by being the first thing Claude reads. It puts Claude in **safe execution mode** for this specific repo.

---

## Safe Execution Mode (what it actually means)

Three rules in practice:

### 1. Explain before acting on live infrastructure

Before running `terraform apply`, `kubectl apply`, or any AWS CLI mutating command, Claude must:
- State explicitly what it's about to do
- State why
- Wait for confirmation if the action is destructive

This exists because silent infra commands are the failure mode — a misconfigured `terraform apply` that deletes a security group is much worse than one that needs to be explained first.

### 2. Sacred files — never touch as a side effect

The triage scoring engine lives in:
- `backend/app/ml/hard_rules.py` — deterministic safety gate
- `backend/app/ml/model_loader.py` — LightGBM scoring
- `backend/app/services/queue_manager.py` — retriage/surge logic

These files determine patient prioritization. A change here made "to add better logging" that accidentally modifies a threshold is exactly the failure mode this rule prevents.

**Read-only inspection of these files is fine.** The restriction is on modification.

### 3. Destructive actions require explicit confirmation

Even if a previous message said "clean up everything", a `terraform destroy` or `kubectl delete namespace` requires a fresh confirmation at the moment of execution. This is because context degrades across long conversations and "clean up" can be interpreted too broadly.

---

## MCP Servers

The four MCP servers listed in CLAUDE.md give Claude Code access to:

| Server | What you can do with it |
|--------|------------------------|
| `awslabs.eks-mcp-server` | Ask "what pods are running?" — get live answer |
| `awslabs.terraform-mcp-server` | Run `terraform plan`, search provider docs, Checkov scan |
| `awslabs.aws-pricing-mcp-server` | "How much will adding a NAT Gateway cost?" — real-time answer |
| `awslabs.core-mcp-server` | Meta-orchestration for the other servers |

To set these up: add them to `~/.claude/settings.json` under `mcpServers`.

---

## The `terraform-skill` Reference

Skills are Claude Code's way of loading domain-specific knowledge on demand. The `terraform-skill` provides:
- Terraform module patterns for AWS
- Testing strategy (Terratest)
- Security scanning conventions (Checkov)
- IaC-specific CI/CD pipeline patterns

It's invoked automatically when Claude Code detects Terraform work in the session.

---

## Branch Strategy

The CLAUDE.md boundary note is important for hackathon context:
- **Hackathon deliverable** = triage model + explainability (in `main`)
- **DevOps buildout** = this entire infrastructure layer (on `devops/*` branches)

Don't let a 2am Terraform debugging session crowd out model work before a submission deadline. Keep them on separate branches.

---

## How to Update CLAUDE.md

If you add a new component (e.g., PostgreSQL, a Redis cache, a new MCP server), update CLAUDE.md to:
1. Reflect the updated current state
2. Add any new sacred files that shouldn't be touched
3. Update the MCP server table if new servers are added

CLAUDE.md is version-controlled — treat it as living documentation.
