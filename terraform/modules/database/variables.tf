variable "name_prefix" {
  description = "Prefix used for database resources."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets for the database."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group for the database."
  type        = string
}

variable "instance_class" {
  description = "RDS instance size."
  type        = string
  default     = "db.t3.micro"
}