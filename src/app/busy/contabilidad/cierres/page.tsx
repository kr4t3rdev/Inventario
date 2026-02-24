'use client'

import { CierresManager } from "@/components/contabilidad/cierres/CierresManager";

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