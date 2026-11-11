import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('API - Health checks', () => {
  it('GET /api/ping devuelve pong', async () => {
    const response = await request(app).get('/api/ping');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'pong',
    });
  });

  it('GET /api/health devuelve el estado correcto', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
    });
  });
});
