import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { getCategoriasHandler, createCategoriaHandler } from '@/features/categorias/api/handlers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(getCategoriasHandler);
export const POST = withAuthPost(async (req, ctx, user) => {
  const result = await createCategoriaHandler(req, ctx, user);
  return NextResponse.json(result);
});
