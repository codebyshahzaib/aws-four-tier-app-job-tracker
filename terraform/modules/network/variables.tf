variable "name_prefix" {
  description = "Prefix used for network resource names."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR range for the VPC."
  type        = string
}

variable "availability_zones" {
  description = "Availability Zones for the subnets."
  type        = list(string)
}