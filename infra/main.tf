terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ---------------------------------------------------------------------------
# Security Group
# ---------------------------------------------------------------------------
resource "aws_security_group" "css" {
  name        = "css-solid-pods"
  description = "Allow SSH from my IP, HTTP/HTTPS from everywhere"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "css-solid-pods" }
}

# ---------------------------------------------------------------------------
# EC2 Instance
# ---------------------------------------------------------------------------
resource "aws_instance" "css" {
  ami                    = var.ami
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  vpc_security_group_ids = [aws_security_group.css.id]

  user_data = templatefile("${path.module}/user-data.sh", {
    subdomain = "vaults.selfactual.ai"
  })

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = { Name = "css-solid-pods" }
}

# ---------------------------------------------------------------------------
# Elastic IP  (stable address for DNS)
# ---------------------------------------------------------------------------
resource "aws_eip" "css" {
  instance = aws_instance.css.id
  domain   = "vpc"
  tags     = { Name = "css-solid-pods" }
}

# ---------------------------------------------------------------------------
# DNS: vaults.selfactual.ai is managed outside AWS.
# After apply, create an A record at your DNS provider:
#   Name: vaults   Type: A   Value: <public_ip output>
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------
output "instance_id" {
  value = aws_instance.css.id
}

output "public_ip" {
  value = aws_eip.css.public_ip
}

output "vaults_url" {
  value = "https://vaults.selfactual.ai/"
}

output "ssh_command" {
  value = "ssh -i <your-key>.pem ubuntu@${aws_eip.css.public_ip}"
}
