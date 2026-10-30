output "vpc_id" {
  description = "ID of the application VPC."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets."
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private application subnets."
  value       = module.network.private_subnet_ids
}

output "security_group_ids" {
  description = "Security group IDs for the application services."
  value       = module.security.security_group_ids
}

output "ec2_public_ip" {
  description = "The private EC2 instance has no public IP."
  value       = null
}

output "ec2_private_ip" {
  description = "Private IP address of the EC2 server."
  value       = module.ec2.private_ip
}

output "frontend_bucket_name" {
  description = "S3 bucket for the static frontend."
  value       = module.storage.bucket_name
}

output "frontend_website_endpoint" {
  description = "S3 website endpoint for the static frontend."
  value       = module.storage.website_endpoint
}

output "database_endpoint" {
  description = "RDS PostgreSQL endpoint."
  value       = module.database.endpoint
}

output "alb_dns_name" {
  description = "Public DNS name for the dynamic API."
  value       = module.alb.dns_name
}

output "ec2_instance_id" {
  description = "EC2 instance ID for Systems Manager access."
  value       = module.ec2.instance_id
}

output "database_password" {
  description = "RDS password."
  value       = module.database.password
  sensitive   = true
}