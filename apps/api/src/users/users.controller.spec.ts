import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('UsersController (mass-assignment protection)', () => {
  let app: INestApplication;

  const service = {
    profile: jest.fn((id: string) => ({ id })),
    updateProfile: jest.fn((_id: string, data: any) => ({ id: 'user-1', ...data })),
    changePassword: jest.fn(async () => ({ ok: true })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects role escalation via PATCH /users/me', () => {
    return request(app.getHttpServer())
      .patch('/users/me')
      .send({ fullName: 'Hacker', role: 'admin' })
      .expect(400);
  });

  it('rejects unknown fields entirely', () => {
    return request(app.getHttpServer())
      .patch('/users/me')
      .send({ isActive: false, quotaAi: 999999 })
      .expect(400);
  });

  it('accepts only allowed profile fields', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({ fullName: 'Nama Baru', timezone: 'Asia/Jakarta', username: 'valid-123' })
      .expect(200)
      .expect((res) => {
        expect(res.body.fullName).toBe('Nama Baru');
        expect(res.body.role).toBeUndefined();
      });

    expect(service.updateProfile).toHaveBeenCalledWith(
      undefined,
      { fullName: 'Nama Baru', timezone: 'Asia/Jakarta', username: 'valid-123' },
    );
  });

  it('validates username format', () => {
    return request(app.getHttpServer())
      .patch('/users/me')
      .send({ username: 'bad username!' })
      .expect(400);
  });
});
