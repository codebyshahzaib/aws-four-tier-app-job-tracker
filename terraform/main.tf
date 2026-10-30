module "network" {
  source = "./modules/network"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

module "security" {
  source = "./modules/security"

  name_prefix = local.name_prefix
  vpc_id      = module.network.vpc_id
}

module "ec2" {
  source = "./modules/ec2"

  name_prefix       = local.name_prefix
  subnet_id         = module.network.private_subnet_ids[0]
  security_group_id = module.security.security_group_ids.ec2
}

module "storage" {
  source = "./modules/storage"

  name_prefix = local.name_prefix
}

module "database" {
  source = "./modules/database"

  name_prefix        = local.name_prefix
  private_subnet_ids = module.network.private_subnet_ids
  security_group_id  = module.security.security_group_ids.database
}

module "alb" {
  source = "./modules/alb"

  name_prefix        = local.name_prefix
  public_subnet_ids  = module.network.public_subnet_ids
  vpc_id             = module.network.vpc_id
  security_group_id  = module.security.security_group_ids.alb
  target_instance_id = module.ec2.instance_id
}
