import type { User as PrismaUser } from '@/app/models/model';

export type Profile = Pick<PrismaUser, 'userId' | 'name' | 'email' | 'role' | 'avatar' | 'isActive' | 'activatedAt' | 'expiresAt' | 'createdAt' | 'updatedAt'>;
