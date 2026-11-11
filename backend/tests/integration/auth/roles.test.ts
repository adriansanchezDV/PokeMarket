import { createUser, createToken } from '../../helpers/userTestHelpers.js';

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
describe('Autorización por roles', () => {
  describe('GET /api/auth/seller-test', () => {
    it('rechaza a un customer autenticado', async () => {
      const user = await createUser({ role: 'customer' });
      const token = createToken(user);

      const response = await request(app)
        .get('/api/auth/seller-test')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('rechaza a un admin en una ruta exclusiva para sellers', async () => {
      const user = await createUser({ role: 'admin' });
      const token = createToken(user);

      const response = await request(app)
        .get('/api/auth/seller-test')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('permite el acceso a un seller autenticado', async () => {
      const user = await createUser({ role: 'seller' });
      const token = createToken(user);

      const response = await request(app)
        .get('/api/auth/seller-test')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });

  it.each([
    { previous: 'seller' as const, current: 'customer' as const, status: 403 },
    { previous: 'customer' as const, current: 'seller' as const, status: 200 },
  ])(
    'aplica el rol actual de PostgreSQL: $previous → $current',
    async ({ previous, current, status }) => {
      const user = await createUser({ role: previous });
      const token = createToken(user);
      await user.update({ role: current });
      const response = await request(app)
        .get('/api/auth/seller-test')
        .set('Authorization', 'Bearer ' + token);
      expect(response.status).toBe(status);
      expect((await user.reload()).role).toBe(current);
    },
  );
});
