# AIOps Terraform — Bedrock Agent + Lambda action groups
#
# SAFE EXECUTION MODE: This is IaC source only.
# Run `terraform init && terraform plan && terraform apply` to provision.

terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project   = "patient-triage"
      Component = "aiops"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── Lambda: CloudWatch Queries ─────────────────────────────────────────────────
data "archive_file" "cloudwatch_queries" {
  type        = "zip"
  source_file = "${path.module}/../action-groups/cloudwatch-queries/lambda_handler.py"
  output_path = "${path.module}/.build/cloudwatch-queries.zip"
}

resource "aws_lambda_function" "cloudwatch_queries" {
  function_name    = "patient-triage-aiops-cloudwatch-queries"
  description      = "Bedrock Agent action group — CloudWatch Logs Insights queries for triage signals"
  role             = aws_iam_role.lambda_aiops.arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.cloudwatch_queries.output_path
  source_code_hash = data.archive_file.cloudwatch_queries.output_base64sha256
  timeout          = 60  # Logs Insights queries can take up to 30s
  memory_size      = 256

  environment {
    variables = {
      BACKEND_LOG_GROUP            = var.backend_log_group
      INTAKE_LATENCY_THRESHOLD_MS  = "2000"
      REVITALS_LATENCY_THRESHOLD_MS = "3000"
    }
  }
}

# ── Lambda: Prometheus Alerts ──────────────────────────────────────────────────
data "archive_file" "prometheus_alerts" {
  type        = "zip"
  source_file = "${path.module}/../action-groups/prometheus-alerts/lambda_handler.py"
  output_path = "${path.module}/.build/prometheus-alerts.zip"
}

resource "aws_lambda_function" "prometheus_alerts" {
  function_name    = "patient-triage-aiops-prometheus-alerts"
  description      = "Bedrock Agent action group — Prometheus alert state queries"
  role             = aws_iam_role.lambda_aiops.arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.prometheus_alerts.output_path
  source_code_hash = data.archive_file.prometheus_alerts.output_base64sha256
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      PROMETHEUS_URL = var.prometheus_url
    }
  }
}

# ── IAM: Lambda execution role ─────────────────────────────────────────────────
resource "aws_iam_role" "lambda_aiops" {
  name = "patient-triage-aiops-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_aiops.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_cloudwatch_read" {
  name = "cloudwatch-read-only"
  role = aws_iam_role.lambda_aiops.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "LogsInsightsRead"
        Effect = "Allow"
        Action = [
          "logs:StartQuery",
          "logs:GetQueryResults",
          "logs:StopQuery",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/patient-triage/*"
      },
      {
        Sid    = "MetricsRead"
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
        ]
        Resource = "*"
      }
    ]
  })
}

# ── Bedrock Agent ──────────────────────────────────────────────────────────────
resource "aws_iam_role" "bedrock_agent" {
  name = "patient-triage-bedrock-agent-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "bedrock_agent_policy" {
  name = "bedrock-agent-invoke"
  role = aws_iam_role.bedrock_agent.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = [
          aws_lambda_function.cloudwatch_queries.arn,
          aws_lambda_function.prometheus_alerts.arn,
        ]
      }
    ]
  })
}

resource "aws_bedrockagent_agent" "triage_ops" {
  agent_name              = "PatientTriageOpsAgent"
  description             = "Triage-domain AIOps agent for PatientTriage.ai — monitors escalation rates, override rates, audit integrity, and API latency."
  agent_resource_role_arn = aws_iam_role.bedrock_agent.arn
  foundation_model        = "anthropic.claude-3-haiku-20240307-v1:0"
  idle_session_ttl_in_secs = 600

  instruction = file("${path.module}/../agent-definition.json") == "" ? "You are a triage ops monitoring agent." : jsondecode(file("${path.module}/../agent-definition.json"))["instruction"]
}

resource "aws_bedrockagent_agent_alias" "triage_ops_live" {
  agent_alias_name = "live"
  agent_id         = aws_bedrockagent_agent.triage_ops.agent_id
  description      = "Live alias for the PatientTriage AIOps agent"
}

# ── Action Groups ──────────────────────────────────────────────────────────────
resource "aws_bedrockagent_agent_action_group" "cloudwatch_queries" {
  agent_id          = aws_bedrockagent_agent.triage_ops.agent_id
  agent_version     = "DRAFT"
  action_group_name = "cloudwatch-queries"
  description       = "Query CloudWatch Logs Insights and Metrics for triage-specific signals"

  action_group_executor {
    lambda = aws_lambda_function.cloudwatch_queries.arn
  }

  api_schema {
    s3 {
      s3_bucket_name = aws_s3_object.cloudwatch_schema.bucket
      s3_object_key  = aws_s3_object.cloudwatch_schema.key
    }
  }
}

resource "aws_bedrockagent_agent_action_group" "prometheus_alerts" {
  agent_id          = aws_bedrockagent_agent.triage_ops.agent_id
  agent_version     = "DRAFT"
  action_group_name = "prometheus-alerts"
  description       = "Query Prometheus alert state and metric values"

  action_group_executor {
    lambda = aws_lambda_function.prometheus_alerts.arn
  }

  api_schema {
    s3 {
      s3_bucket_name = aws_s3_object.prometheus_schema.bucket
      s3_object_key  = aws_s3_object.prometheus_schema.key
    }
  }
}

# Lambda invocation permissions for Bedrock Agent
resource "aws_lambda_permission" "bedrock_cloudwatch" {
  statement_id  = "AllowBedrockAgentInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cloudwatch_queries.function_name
  principal     = "bedrock.amazonaws.com"
  source_arn    = aws_bedrockagent_agent.triage_ops.agent_arn
}

resource "aws_lambda_permission" "bedrock_prometheus" {
  statement_id  = "AllowBedrockAgentInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.prometheus_alerts.function_name
  principal     = "bedrock.amazonaws.com"
  source_arn    = aws_bedrockagent_agent.triage_ops.agent_arn
}

# ── S3 bucket for API schemas ──────────────────────────────────────────────────
resource "aws_s3_bucket" "aiops_schemas" {
  bucket = "patient-triage-aiops-schemas-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "schemas" {
  bucket = aws_s3_bucket.aiops_schemas.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_object" "cloudwatch_schema" {
  bucket       = aws_s3_bucket.aiops_schemas.id
  key          = "cloudwatch-queries/schema.json"
  source       = "${path.module}/../action-groups/cloudwatch-queries/schema.json"
  content_type = "application/json"
  etag         = filemd5("${path.module}/../action-groups/cloudwatch-queries/schema.json")
}

resource "aws_s3_object" "prometheus_schema" {
  bucket       = aws_s3_bucket.aiops_schemas.id
  key          = "prometheus-alerts/schema.json"
  source       = "${path.module}/../action-groups/prometheus-alerts/schema.json"
  content_type = "application/json"
  etag         = filemd5("${path.module}/../action-groups/prometheus-alerts/schema.json")
}

# ── EventBridge: 15-minute schedule during hospital hours ─────────────────────
resource "aws_scheduler_schedule" "aiops_trigger" {
  name        = "patient-triage-aiops-trigger"
  description = "Trigger AIOps agent every 15 minutes during hospital hours (6am–midnight IST = 00:30–18:30 UTC)"

  schedule_expression          = "cron(0/15 0-18 * * ? *)"
  schedule_expression_timezone = "UTC"

  flexible_time_window {
    mode                      = "FLEXIBLE"
    maximum_window_in_minutes = 5
  }

  target {
    arn      = aws_bedrockagent_agent_alias.triage_ops_live.agent_alias_arn
    role_arn = aws_iam_role.scheduler_aiops.arn

    input = jsonencode({
      inputText = "Analyse the last 30 minutes of triage operations and report any anomalies. Focus on: escalation rate, override rate, audit log integrity, and API latency on the critical path endpoints."
    })
  }
}

resource "aws_iam_role" "scheduler_aiops" {
  name = "patient-triage-scheduler-aiops-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_bedrock" {
  name = "invoke-bedrock-agent"
  role = aws_iam_role.scheduler_aiops.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["bedrock:InvokeAgent"]
      Resource = aws_bedrockagent_agent_alias.triage_ops_live.agent_alias_arn
    }]
  })
}
