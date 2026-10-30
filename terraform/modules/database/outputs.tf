output "endpoint" {
  description = "RDS database endpoint."
  value       = aws_db_instance.this.address
}
output "password" {
  description = "RDS password."
  value       = random_password.this.result
  sensitive   = true
}