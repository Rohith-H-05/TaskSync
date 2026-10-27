output "instance_id" {
  description = "The ID of the EC2 instance"
  value       = aws_instance.tasksync_server.id
}

output "public_ip" {
  description = "Public IPv4 address of the TaskSync server"
  value       = aws_instance.tasksync_server.public_ip
}

output "public_dns" {
  description = "Public DNS of the TaskSync server"
  value       = aws_instance.tasksync_server.public_dns
}

output "app_url" {
  description = "TaskSync Web Application URL"
  value       = "http://${aws_instance.tasksync_server.public_ip}"
}

output "api_url" {
  description = "TaskSync GraphQL API & WebSocket endpoint"
  value       = "http://${aws_instance.tasksync_server.public_ip}:4000/graphql"
}

output "mailpit_url" {
  description = "Mailpit notification testing dashboard"
  value       = "http://${aws_instance.tasksync_server.public_ip}:8025"
}

output "ssh_command" {
  description = "Command to connect via SSH"
  value       = "ssh -i <path-to-key.pem> ubuntu@${aws_instance.tasksync_server.public_ip}"
}

