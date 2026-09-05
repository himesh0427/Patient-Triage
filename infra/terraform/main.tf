# ────────────────────────────────────────────────────────────────────────────
# PatientTriage.ai — Terraform root
#
# SAFE EXECUTION MODE: This file is IaC source only.
# Nothing is applied to AWS until you run:
#   terraform init && terraform plan && terraform apply
#
# Cost guidance (us-east-1, 2 t3.medium nodes ~730h/month):
#   EKS control plane:   $73/month
#   2× t3.medium nodes:  ~$60/month
#   NAT Gateway:         ~$32/month
#   ALB:                 ~$16/month
#   ECR storage:         ~$1/month (minimal images)
#   CloudWatch logs:     ~$2/month
#   Total estimate:      ~$184/month
#
# To minimise cost: set desired_capacity = 1 and use spot instances.
# ────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }
  }

  # Uncomment after creating the S3 bucket + DynamoDB table for remote state.
  # Run `terraform init -backend-config=backend.hcl` to bootstrap.
  #
  # backend "s3" {
  #   bucket         = "patient-triage-tf-state"
  #   key            = "patient-triage/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "patient-triage-tf-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "patient-triage"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "devops"
    }
  }
}

# Used after EKS cluster is created to interact with it
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks", "get-token",
      "--cluster-name", module.eks.cluster_name,
      "--region", var.aws_region,
    ]
  }
}

# Pull current AWS account / region data for use in ARN construction
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}
