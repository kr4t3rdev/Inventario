'use client';

import type { JSX } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ModulePlaceholderProps {
  title: string;
  description: string;
}

/**
 * @description Tarjeta de placeholder para submódulos aún en implementación.
 * @param {ModulePlaceholderProps} props - Propiedades del placeholder.
 * @returns {JSX.Element} Tarjeta de estado del submódulo.
 */
export function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps): JSX.Element {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className='px-4 py-6 md:px-6'>
      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.24,
          ease: 'easeOut' as const,
        }}
      >
        <Card className='max-w-2xl border-dashed'>
          <CardHeader className='space-y-3'>
            <div className='inline-flex w-fit rounded-lg bg-primary/10 p-2 text-primary'>
              <Wrench className='h-5 w-5' />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className='text-sm text-muted-foreground'>
            Este submódulo ya tiene ruta activa y queda listo para la siguiente iteración.
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
