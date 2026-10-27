terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "TaskSync"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# Networking Data Sources (Uses Default VPC for Simple Deployment)
# -----------------------------------------------------------------------------
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# -----------------------------------------------------------------------------
# Ubuntu 22.04 LTS Official Canonical AMI
# -----------------------------------------------------------------------------
data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical official AWS account ID
}

# -----------------------------------------------------------------------------
# Security Group
# -----------------------------------------------------------------------------
resource "aws_security_group" "tasksync_sg" {
  name        = "tasksync-${var.environment}-sg"
  description = "Security group for TaskSync web app, GraphQL API, and SSH"
  vpc_id      = data.aws_vpc.default.id

  # SSH
  ingress {
    description = "SSH administrative access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # HTTP (Web Frontend / Reverse Proxy)
  ingress {
    description = "HTTP web traffic"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    description = "HTTPS web traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # GraphQL API & WebSocket direct port
  ingress {
    description = "GraphQL API and Subscriptions port"
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Mailpit Web UI (Testing / Evaluation)
  ingress {
    description = "Mailpit testing web interface"
    from_port   = 8025
    to_port     = 8025
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound Internet Access
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "tasksync-${var.environment}-sg"
  }
}

# -----------------------------------------------------------------------------
# EC2 Instance
# -----------------------------------------------------------------------------
resource "aws_instance" "tasksync_server" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = tolist(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids      = [aws_security_group.tasksync_sg.id]
  associate_public_ip_address = true
  key_name                    = var.ssh_key_name != "" ? var.ssh_key_name : null

  root_block_device {
    volume_size           = 25
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true
  }

  user_data = <<-EOF
              #!/bin/bash
              set -ex

              # Update and install Docker prerequisites
              apt-get update -y
              apt-get install -y ca-certificates curl gnupg git

              # Install official Docker repository
              install -m 0755 -d /etc/apt/keyrings
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
              chmod a+r /etc/apt/keyrings/docker.gpg

              echo \
                "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
                "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
                tee /etc/apt/sources.list.d/docker.list > /dev/null

              apt-get update -y
              apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

              systemctl enable docker
              systemctl start docker
              usermod -aG docker ubuntu

              # Create application directory
              mkdir -p /opt/tasksync
              chown -R ubuntu:ubuntu /opt/tasksync

              echo "Docker and Docker Compose successfully installed on TaskSync EC2 host." > /opt/tasksync/setup_complete.txt
              EOF

  tags = {
    Name = "tasksync-${var.environment}-server"
  }
}

