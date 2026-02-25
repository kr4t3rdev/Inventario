import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * @description Página 404 personalizada con animación
 * @returns {JSX.Element} Página de error 404
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="relative w-64 h-64 mx-auto animate-float">
          <img
            src="/robot-404.png"
            alt="Robot 404"
            className="w-full h-full object-contain"
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
