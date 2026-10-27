# TaskSync Infrastructure as Code (Terraform for AWS)

This directory provides Terraform configurations to provision the AWS cloud infrastructure required to host TaskSync on a single EC2 instance with Docker and Docker Compose.

---

## Architecture Overview

- **Cloud Provider**: AWS
- **Compute**: 1x `t3.small` EC2 instance running Ubuntu 22.04 LTS (2 vCPU, 2GB RAM, 25GB gp3 SSD).
- **Networking**: Deploys into your default VPC across standard subnets.
- **Security Group (`tasksync_sg`)**:
  - `22`: SSH administrative access.
  - `80`: Web HTTP traffic (Nginx frontend container reverse-proxying to GraphQL).
  - `443`: HTTPS TLS web traffic.
  - `4000`: Direct GraphQL HTTP and WebSocket subscriptions endpoint.
  - `8025`: Mailpit web UI for inspecting email notifications.
- **Automation (`user_data`)**: Automatically provisions Docker Engine, Docker Compose plugin, and sets up systemd services on instance launch.

---

## Deployment Instructions

### 1. Prerequisites
- [AWS CLI](https://aws.amazon.com/cli/) installed and configured (`aws configure`).
- [Terraform CLI](https://developer.hashicorp.com/terraform/install) (>= 1.5.0) installed.

### 2. Configure Variables
Copy the example variables file:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Edit `terraform.tfvars` with your key pair name and preferred AWS region:
```hcl
aws_region   = "us-east-1"
ssh_key_name = "my-aws-key-pair"
```

### 3. Initialize & Validate
```bash
terraform init
terraform validate
```

### 4. Review Plan & Apply
```bash
terraform plan
terraform apply
```

After provisioning completes, Terraform outputs the public IP and accessible URLs:
```bash
Apply complete! Resources: 2 added, 0 changed, 0 destroyed.

Outputs:
app_url = "http://54.210.xxx.xxx"
api_url = "http://54.210.xxx.xxx:4000/graphql"
mailpit_url = "http://54.210.xxx.xxx:8025"
ssh_command = "ssh -i <path-to-key.pem> ubuntu@54.210.xxx.xxx"
```

### 5. Running the Application on EC2
SSH into the instance using the command from the output:
```bash
ssh -i <your-key.pem> ubuntu@<instance-public-ip>
```
Clone the repository and run Docker Compose:
```bash
git clone https://github.com/your-username/TaskSync.git /opt/tasksync/app
cd /opt/tasksync/app
cp .env.example .env
docker compose up -d
```

### 6. Teardown
To destroy all created resources and prevent unwanted AWS billing:
```bash
terraform destroy
```

