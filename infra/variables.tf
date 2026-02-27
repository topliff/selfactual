variable "aws_region" {
  default = "us-west-2"
}

variable "my_ip" {
  description = "Your public IP for SSH access (CIDR, e.g. 203.0.113.42/32)"
  type        = string
}

variable "key_pair_name" {
  description = "Name of an existing EC2 key pair for SSH"
  type        = string
}

variable "instance_type" {
  default = "t3.small"
}

variable "ami" {
  description = "Ubuntu 24.04 LTS AMI in us-west-2 (default is Canonical's)"
  default     = "ami-0b8c6b923777519db" # Ubuntu 24.04 LTS us-west-2 — verify in console
}
