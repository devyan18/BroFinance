import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

export default async function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  provide('mongoUri', uri);

  return async () => {
    await mongoServer.stop();
  };
}
