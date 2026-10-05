import { defineConfig } from 'prisma/config'

// Prisma 6 con config file ya no carga .env automáticamente; lo cargamos aquí
// para que `prisma migrate`/`db push`/`studio` funcionen sin exportar a mano.
process.loadEnvFile()

export default defineConfig({
  schema: 'prisma/schema.prisma',
  engine: 'classic',
  datasource: {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
})
