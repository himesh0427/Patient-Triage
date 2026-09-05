# ── CloudWatch Log Groups ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/patient-triage/backend"
  retention_in_days = var.log_retention_days
  tags              = { Name = "patient-triage-backend-logs" }
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/patient-triage/frontend"
  retention_in_days = var.log_retention_days
  tags              = { Name = "patient-triage-frontend-logs" }
}

resource "aws_cloudwatch_log_group" "eks_control_plane" {
  name              = "/aws/eks/${var.cluster_name}/cluster"
  retention_in_days = var.log_retention_days
  tags              = { Name = "patient-triage-eks-logs" }
}

# ── SNS Topic for Alarm Notifications ────────────────────────────────────────
resource "aws_sns_topic" "triage_alerts" {
  name = "${var.cluster_name}-triage-alerts"
  tags = { Name = "patient-triage-alerts-topic" }
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_sns_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.triage_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_sns_email
}

# ── Metric Filters: Triage-Specific Signals ───────────────────────────────────
#
# These extract structured metrics from the backend log stream.
# The backend logs audit events as JSON lines; the filters count specific events.
#
# Pattern: { $.action = "AUTO_ESCALATE_SURGE" } counts escalation events.
# Prometheus handles fine-grained metrics; CloudWatch filters give a durable,
# AWS-native signal for the AIOps Bedrock Agent to query.

# 1. Escalation events (confidence-driven severity bump)
resource "aws_cloudwatch_log_metric_filter" "escalation_events" {
  name           = "TriageEscalationEvents"
  pattern        = "{ $.action = \"AUTO_ESCALATE_SURGE\" }"
  log_group_name = aws_cloudwatch_log_group.backend.name

  metric_transformation {
    name          = "EscalationEventCount"
    namespace     = "PatientTriage/Triage"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# 2. Override events (clinician disagreed with AI)
resource "aws_cloudwatch_log_metric_filter" "override_events" {
  name           = "TriageOverrideEvents"
  pattern        = "{ $.action = \"OVERRIDE\" }"
  log_group_name = aws_cloudwatch_log_group.backend.name

  metric_transformation {
    name          = "OverrideEventCount"
    namespace     = "PatientTriage/Triage"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# 3. Audit write failures (P1 compliance signal)
resource "aws_cloudwatch_log_metric_filter" "audit_write_failures" {
  name           = "AuditWriteFailures"
  pattern        = "audit_write_error"
  log_group_name = aws_cloudwatch_log_group.backend.name

  metric_transformation {
    name          = "AuditWriteFailureCount"
    namespace     = "PatientTriage/Compliance"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# 4. Low-confidence predictions (model calibration signal)
resource "aws_cloudwatch_log_metric_filter" "low_confidence" {
  name           = "LowConfidencePredictions"
  pattern        = "{ $.action = \"LOW_CONFIDENCE_TRIAGE\" }"
  log_group_name = aws_cloudwatch_log_group.backend.name

  metric_transformation {
    name          = "LowConfidenceCount"
    namespace     = "PatientTriage/Triage"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# ── CloudWatch Alarms ─────────────────────────────────────────────────────────

# Alarm 1: Audit write failures — P1, any non-zero value is actionable
resource "aws_cloudwatch_metric_alarm" "audit_write_failure" {
  alarm_name          = "${var.cluster_name}-audit-write-failure"
  alarm_description   = "COMPLIANCE P1: Audit log write failures detected. Every triage decision must be durably logged."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  namespace   = "PatientTriage/Compliance"
  metric_name = "AuditWriteFailureCount"

  alarm_actions = [aws_sns_topic.triage_alerts.arn]
  ok_actions    = [aws_sns_topic.triage_alerts.arn]

  tags = { Severity = "P1" }
}

# Alarm 2: Override rate spike — 20+ overrides in 10 minutes is unusual
resource "aws_cloudwatch_metric_alarm" "override_rate_spike" {
  alarm_name          = "${var.cluster_name}-override-rate-spike"
  alarm_description   = "Clinician override rate spike — may indicate AI model miscalibration."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  period              = 300
  statistic           = "Sum"
  threshold           = 20
  treat_missing_data  = "notBreaching"

  namespace   = "PatientTriage/Triage"
  metric_name = "OverrideEventCount"

  alarm_actions = [aws_sns_topic.triage_alerts.arn]
  tags          = { Severity = "P2" }
}

# Alarm 3: Zero escalations during active hours (silent failure detection)
# Note: CloudWatch can't natively detect "expected non-zero but got zero".
# The Bedrock AIOps agent handles this logic via CloudWatch Logs Insights queries.
# This alarm fires if escalation count drops to 0 over 60 minutes.
resource "aws_cloudwatch_metric_alarm" "escalation_rate_zero" {
  alarm_name          = "${var.cluster_name}-escalation-rate-zero"
  alarm_description   = "Zero confidence-driven escalations in 60 minutes — possible silent failure in escalation logic."
  comparison_operator = "LessThanOrEqualToThreshold"
  evaluation_periods  = 12  # 12 × 5min periods = 60 min
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "breaching"  # Missing data = possible log pipeline failure

  namespace   = "PatientTriage/Triage"
  metric_name = "EscalationEventCount"

  alarm_actions = [aws_sns_topic.triage_alerts.arn]
  tags          = { Severity = "P2" }
}
