variable "aws_region" {
  description = "AWS region to deploy all resources into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment tag (dev | staging | prod)."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "cluster_name" {
  description = "Name for the EKS cluster (also used as prefix for related resources)."
  type        = string
  default     = "patient-triage"
}

variable "kubernetes_version" {
  description = "Kubernetes version for the EKS cluster."
  type        = string
  default     = "1.30"
}

variable "node_instance_type" {
  description = "EC2 instance type for EKS managed node group."
  type        = string
  default     = "t3.medium"
  # t3.medium: 2 vCPU, 4 GB RAM — adequate for portfolio scale.
  # Upgrade to t3.large / m5.large for production load.
}

variable "node_desired_capacity" {
  description = "Desired number of worker nodes."
  type        = number
  default     = 2
}

variable "node_min_capacity" {
  description = "Minimum number of worker nodes."
  type        = number
  default     = 1
}

variable "node_max_capacity" {
  description = "Maximum number of worker nodes (for cluster autoscaler)."
  type        = number
  default     = 4
}

variable "use_spot_instances" {
  description = "Use EC2 Spot Instances for worker nodes (reduces cost ~70%)."
  type        = bool
  default     = false
  # Set to true for dev/portfolio. Not recommended for anything patient-facing.
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "log_retention_days" {
  description = "CloudWatch log group retention period in days."
  type        = number
  default     = 30
}

variable "alert_sns_email" {
  description = "Email address to receive CloudWatch alarm notifications."
  type        = string
  default     = ""
  # Set this via -var or tfvars; leave empty to skip SNS subscription.
}

variable "github_org" {
  description = "GitHub organization or username for the OIDC IAM role trust policy."
  type        = string
  default     = "your-github-username"
}

variable "github_repo" {
  description = "GitHub repository name for the OIDC IAM role trust policy."
  type        = string
  default     = "Patient-Triage"
}
