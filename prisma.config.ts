import { defineConfig } from 'prisma/config'

// Prisma 6 con config file ya no carga .env automáticamente; lo cargamos aquí
// para que `prisma migrate`/`db push`/`studio` funcionen sin exportar a mano.
try {
  process.loadEnvFile();
} catch (error) {
  // Railway/Vercel inyectan las variables sin crear un archivo .env.
  if (!(typeof error === 'object' && error !== null
    && 'code' in error && error.code === 'ENOENT')) {
    throw error;
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  engine: 'classic',
  datasource: {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
})
