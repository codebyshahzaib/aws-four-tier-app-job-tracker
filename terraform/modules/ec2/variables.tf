variable "name_prefix" {
  description = "Prefix used for the EC2 instance name."
  type        = string
}

variable "subnet_id" {
  description = "Private subnet where the EC2 instance is created."
  type        = string
}

variable "security_group_id" {
  description = "Security group attached to the EC2 instance."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance size."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size" {
  description = "Root disk size in GiB."
  type        = number
  default     = 30
}
