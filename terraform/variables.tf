variable "project_name" {
  description = "Short name used in AWS resource names."
  type        = string
  default     = "jobtrack"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR range for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Two Availability Zones used by the load balancer and database."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}