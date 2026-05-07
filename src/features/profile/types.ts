import type { User as PrismaUser } from '@/generated/prisma';

export type Profile = Pick<PrismaUser, 'userId' | 'name' | 'email' | 'role' | 'avatar' | 'isActive' | 'activatedAt' | 'expiresAt' | 'createdAt' | 'updatedAt'>;
