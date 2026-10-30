## Terraform infrastructure

The current simple architecture creates:

- One VPC
- One Internet Gateway
- Two public subnets in `us-east-1a` and `us-east-1b`
- Two private subnets in `us-east-1a` and `us-east-1b`
- Public and private route tables
- One NAT Gateway for private outbound traffic
- Systems Manager VPC endpoints in the private subnets
- One private EC2 instance for the backend and worker
- One private RDS PostgreSQL database
- One public S3 website bucket for the static frontend
- One public Application Load Balancer for the dynamic API

ECS resources and ECS-specific security groups are not included.

The AWS provider is permanently locked to `us-east-1` in this configuration
to keep the project within one region and control costs. Do not add another
provider region unless the architecture is explicitly changed.

The default configuration uses one AWS region:

- Project name: `jobtrack`
- Region: `us-east-1`
- Availability Zones: `us-east-1a` and `us-east-1b`

The EC2 instance remains in the first private subnet. The ALB uses both public
subnets, and RDS uses both private subnets.

The EC2 instance uses a `t3.small` size and a 30 GiB encrypted `gp3` root disk.
This provides more memory for Docker builds and containers and more space for
images, logs, and temporary files.

The three Systems Manager interface endpoints keep SSM traffic private:

- `ssm`
- `ssmmessages`
- `ec2messages`

Interface endpoints have an hourly and data-processing charge in each
Availability Zone. They are enabled to make private EC2 management reliable.

Validate it with:

```bash
terraform init
terraform fmt -recursive
terraform validate
terraform plan
```

Do not run `terraform apply` until the plan and costs have been reviewed.