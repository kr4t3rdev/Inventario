// dotenv/config se usa solo en desarrollo local para cargar .env
// En Railway o entornos con DATABASE_URL ya definida, no hace falta.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv/config');
}

// Prisma config inline - evita importar 'prisma/config' que no se resuelve
// cuando 'npx prisma db execute' carga este archivo standalone.
export default {
  schema: 'prisma/schema.prisma',
  engine: 'classic',
  datasource: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
};
