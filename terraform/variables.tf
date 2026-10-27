variable "aws_region" {
  description = "AWS region to deploy resources into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance type for TaskSync monorepo containers"
  type        = string
  default     = "t3.small"
}

variable "ssh_key_name" {
  description = "Optional name of an existing EC2 Key Pair for SSH access"
  type        = string
  default     = ""
}

variable "allowed_ssh_cidr" {
  description = "CIDR block permitted to access SSH on port 22"
  type        = string
  default     = "0.0.0.0/0"
}

