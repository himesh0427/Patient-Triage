variable "aws_region" {
  description = "AWS region for AIOps resources."
  type        = string
  default     = "us-east-1"
}

variable "backend_log_group" {
  description = "CloudWatch log group name for the backend (from infra/terraform output)."
  type        = string
  default     = "/patient-triage/backend"
}

variable "prometheus_url" {
  description = "Internal Prometheus HTTP API URL (Kubernetes service DNS name)."
  type        = string
  default     = "http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090"
}
