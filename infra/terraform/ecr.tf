# ── ECR Repositories ──────────────────────────────────────────────────────────

resource "aws_ecr_repository" "backend" {
  name                 = "${var.cluster_name}/backend"
  image_tag_mutability = "MUTABLE" # allows 'latest' tag; use IMMUTABLE in strict prod

  image_scanning_configuration {
    scan_on_push = true # Free basic scanning via AWS Inspector
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = { Name = "${var.cluster_name}-backend-ecr" }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.cluster_name}/frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = { Name = "${var.cluster_name}-frontend-ecr" }
}

# ── Lifecycle Policies ────────────────────────────────────────────────────────
# Keep the 10 most recent tagged images; expire untagged images after 1 day.
# This prevents ECR storage costs from growing indefinitely in CI.

locals {
  ecr_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["sha-", "v", "latest"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name
  policy     = local.ecr_lifecycle_policy
}

# ── ECR Pull-through cache (optional, for faster CI pulls) ────────────────────
# Uncomment if you want to cache upstream base images (nginx, python) in ECR.
# resource "aws_ecr_pull_through_cache_rule" "docker_hub" {
#   ecr_repository_prefix = "docker-hub"
#   upstream_registry_url  = "registry-1.docker.io"
# }
