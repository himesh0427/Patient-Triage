output "agent_id" {
  description = "Bedrock Agent ID"
  value       = aws_bedrockagent_agent.triage_ops.agent_id
}

output "agent_alias_id" {
  description = "Bedrock Agent Alias ID (use 'live')"
  value       = aws_bedrockagent_agent_alias.triage_ops_live.agent_alias_id
}

output "agent_arn" {
  description = "Bedrock Agent ARN"
  value       = aws_bedrockagent_agent.triage_ops.agent_arn
}

output "cloudwatch_queries_lambda_arn" {
  description = "ARN of the CloudWatch queries Lambda function"
  value       = aws_lambda_function.cloudwatch_queries.arn
}

output "prometheus_alerts_lambda_arn" {
  description = "ARN of the Prometheus alerts Lambda function"
  value       = aws_lambda_function.prometheus_alerts.arn
}

output "test_command" {
  description = "Command to invoke the AIOps agent for testing"
  value       = <<-EOT
    aws bedrock-agent-runtime invoke-agent \
      --agent-id ${aws_bedrockagent_agent.triage_ops.agent_id} \
      --agent-alias-id ${aws_bedrockagent_agent_alias.triage_ops_live.agent_alias_id} \
      --session-id test-$(date +%s) \
      --input-text "Analyse the last 30 minutes of triage operations and report anomalies." \
      --region ${var.aws_region} \
      output.json && cat output.json | python3 -c "import sys,json; [print(c.get('chunk',{}).get('bytes',b'').decode()) for c in json.load(sys.stdin).get('completion',[])]"
  EOT
}
