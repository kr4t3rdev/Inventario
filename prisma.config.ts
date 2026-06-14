export default {
  schema: 'prisma/schema.prisma',
  engine: 'classic',
  datasource: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
};
