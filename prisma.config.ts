// dotenv/config se usa solo en desarrollo local para cargar .env
// En Railway, las variables de entorno ya están disponibles
if (process.env.NODE_ENV !== 'production') {
  require('dotenv/config');
}
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