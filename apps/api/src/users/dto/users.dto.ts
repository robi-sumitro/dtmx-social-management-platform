import { IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';

const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(USERNAME_RE, {
    message: 'Username hanya boleh berisi huruf, angka, titik, garis bawah, dan strip',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  current!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  next!: string;
}
