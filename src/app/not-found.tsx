'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Player } from '@remotion/player';
import { NotFoundAnimation } from '../../remotion/not-found-animation';

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
            compositionWidth={800}
            compositionHeight={600}
            style={{
              width: '100%',
              aspectRatio: '4/3',
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
