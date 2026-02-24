'use client';

import type { JSX } from 'react';
import type { ComponentType } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  ChefHat,
  ClipboardList,
  CreditCard,
  Monitor,
  Users,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RestauranteAccessCard {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const CARDS: RestauranteAccessCard[] = [
  {
    title: 'Mesas',
    description: 'Administrar disponibilidad y ocupación de mesas en tiempo real.',
    href: '/busy/restaurante/mesas',
    icon: Users,
  },
  {
    title: 'POS',
    description: 'Cobro y control de comandas desde caja o tablet del salón.',
    href: '/busy/restaurante/pos',
    icon: CreditCard,
  },
  {
    title: 'Caja POS',
    description: 'Resumen por método de pago y cierre diario del punto de caja.',
    href: '/busy/restaurante/caja',
    icon: Wallet,
  },
  {
    title: 'KDS Cocina',
    description: 'Pantalla de cocina para priorizar comandas y actualizar estados.',
    href: '/busy/restaurante/kds',
    icon: Monitor,
  },
  {
    title: 'Carta',
    description: 'Gestión de categorías y platos disponibles para la venta.',
    href: '/busy/restaurante/carta',
    icon: BookOpen,
  },
  {
    title: 'Recetas',
    description: 'Definición de fichas técnicas y control de costos por porción.',
    href: '/busy/restaurante/recetas',
    icon: ChefHat,
  },
  {
    title: 'Producción',
    description: 'Planificación y seguimiento de órdenes de producción diaria.',
    href: '/busy/restaurante/produccion',
    icon: ClipboardList,
  },
];

/**
 * @description Dashboard inicial del módulo restaurante con accesos rápidos.
 * @param {Record<string, never>} _props - Sin props para esta página.
 * @returns {JSX.Element} Página principal del módulo restaurante.
 */
export default function RestaurantePage(_props: Record<string, never>): JSX.Element {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className='space-y-4 px-4 py-6 md:px-6'>
      <motion.header
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.24,
          ease: 'easeOut' as const,
        }}
      >
        <h1 className='text-2xl font-semibold'>Restaurante</h1>
        <p className='text-sm text-muted-foreground'>
          Módulo operativo para mesas, POS, carta, recetas y producción.
        </p>
      </motion.header>

      <section className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {CARDS.map((card, index) => {
          const Icon = card.icon;

          return (
            <motion.div
              key={card.href}
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.24,
                delay: shouldReduceMotion ? 0 : index * 0.04,
                ease: 'easeOut' as const,
              }}
            >
              <Link href={card.href} className='block h-full'>
                <Card className='h-full cursor-pointer border-border/60 transition-colors hover:border-primary/50'>
                  <CardHeader className='space-y-3'>
                    <div className='inline-flex w-fit rounded-lg bg-primary/10 p-2 text-primary'>
                      <Icon className='h-5 w-5' />
                    </div>
                    <div>
                      <CardTitle>{card.title}</CardTitle>
                      <CardDescription>{card.description}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className='text-sm text-primary'>Abrir módulo</CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </section>
    </div>
  );
}
