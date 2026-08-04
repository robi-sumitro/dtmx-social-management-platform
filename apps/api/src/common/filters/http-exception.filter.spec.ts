import { HttpExceptionFilter } from './http-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';

function mockHost(responseOverrides: any = {}) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = { status, ...responseOverrides };
  const request = { method: 'GET', url: '/api/test' };
  return {
    host: {
      switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    } as any,
    json,
    status,
  };
}

describe('HttpExceptionFilter', () => {
  it('sanitizes unknown errors into a generic 500 response', () => {
    const filter = new HttpExceptionFilter();
    const { host, json, status } = mockHost();

    filter.catch(new Error('leaked internal detail'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        path: '/api/test',
        message: 'Internal server error',
      }),
    );
  });

  it('passes through HttpException messages for client errors', () => {
    const filter = new HttpExceptionFilter();
    const { host, json, status } = mockHost();

    filter.catch(new HttpException('Kuota habis', HttpStatus.BAD_REQUEST), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Kuota habis' }),
    );
  });

  it('joins validation error arrays', () => {
    const filter = new HttpExceptionFilter();
    const { host, json } = mockHost();

    filter.catch(
      new HttpException({ statusCode: 400, message: ['a', 'b'] }, 400),
      host,
    );

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'a, b' }));
  });
});
