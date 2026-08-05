import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEnum(['user', 'admin'])
  role?: string;
}

export class PlanDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  billingPeriodDays?: number;

  @IsInt()
  @Min(0)
  maxAccounts!: number;

  @IsInt()
  @Min(0)
  maxPostsPerMonth!: number;

  @IsInt()
  @Min(0)
  aiPerMonth!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  apiQuotaPerDay?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  billingPeriodDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAccounts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxPostsPerMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  aiPerMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  apiQuotaPerDay?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetFeatureDto {
  @IsBoolean()
  enabled!: boolean;
}

export class SetPaymentMethodsDto {
  @IsArray()
  @IsString({ each: true })
  methods!: string[];
}

export class PaymentSettingDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class AiSettingDto {
  @IsString()
  value!: string;
}
