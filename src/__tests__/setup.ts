import { beforeAll, afterAll, afterEach, inject } from 'vitest';
import mongoose from 'mongoose';
import { seedTiposCompra } from '../modules/compras/compras.seed.ts';

beforeAll(async () => {
  const mongoUri = inject('mongoUri') as string;
  await mongoose.connect(mongoUri);
  await seedTiposCompra();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    if (key !== 'tipocompras') {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});
