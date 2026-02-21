import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './createTestApp.ts';

const app = createTestApp();

describe('GET /health', () => {
  it('returns 200 with success true', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Server is healthy');
    expect(res.body.timestamp).toBeDefined();
  });
});
