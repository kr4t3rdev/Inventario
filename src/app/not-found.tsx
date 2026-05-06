'use client'

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { NotFoundAnimation } from '../../remotion/not-found-animation';

const Player = dynamic(
  () => import('@remotion/player').then((mod) => mod.Player),
  { ssr: false },
)

/**
 * @description Página 404 personalizada con animación de Remotion
 * @returns {JSX.Element} Página de error 404
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-6">
        {/* Reproductor de Remotion para la animación 404 */}
        <div className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-2xl">
          <Player
            component={NotFoundAnimation}
            durationInFrames={180}
            fps={30}
            compositionWidth={600}
            compositionHeight={600}
            style={{
              width: '100%',
              aspectRatio: '10/10',
            }}
            autoPlay
            loop
            controls={false}
          />
        </div>

        <h1 className="text-6xl font-bold text-primary">404</h1>

        <p className="text-xl text-muted-foreground">
          ¡Ups! La página que buscas no existe.
        </p>

        <p className="text-sm text-muted-foreground">
          El robot no encontró lo que buscabas.
        </p>

        <div className="pt-4">
          <Link href="/">
            <Button size="lg">
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
