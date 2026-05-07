'use client'

import { CierresManager } from "@/features/contabilidad/components/cierres/CierresManager";

/**
 * Página principal de cierres contables
 */
export default function CierresPage() {
  return (
    <div className="container mx-auto p-6">
      <CierresManager />
    </div>
  );
}