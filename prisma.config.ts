import { defineConfig, env } from 'prisma/config';

const databaseUrl = env('DATABASE_URL');
const directUrl = process.env.DIRECT_URL?.trim() || databaseUrl;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  engine: 'classic',
  datasource: {
    url: databaseUrl,
    directUrl,
  },
});