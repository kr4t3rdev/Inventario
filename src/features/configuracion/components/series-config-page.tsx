'use client';

import React from 'react';
import SeriesFacturacionTable from '@/features/series-facturacion';

export default function SeriesConfigPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Series de Facturación</h1>
        <p className="text-muted-foreground">
          Gestiona las series de facturación para diferentes tipos de documentos
        </p>
      </div>
      <SeriesFacturacionTable />
    </div>
  );
}
