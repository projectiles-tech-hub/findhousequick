import { redisConnection } from './jobs.module.js';

describe('Redis connection for background jobs', () => {
  it('reads host, port, password, database and TLS from the address', () => {
    expect(redisConnection('rediss://user:p%40ss@redis.example.com:6380/2')).toMatchObject({
      host: 'redis.example.com',
      port: 6380,
      username: 'user',
      password: 'p@ss',
      db: 2,
      tls: {},
      maxRetriesPerRequest: null,
    });
    expect(redisConnection('redis://localhost')).toMatchObject({ host: 'localhost', port: 6379, db: 0, tls: undefined });
  });
});
