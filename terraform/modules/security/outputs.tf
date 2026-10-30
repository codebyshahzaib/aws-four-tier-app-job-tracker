output "security_group_ids" {
  description = "Security group for the temporary EC2 server."
  value = {
    ec2      = aws_security_group.ec2.id
    alb      = aws_security_group.alb.id
    database = aws_security_group.database.id
  }
}