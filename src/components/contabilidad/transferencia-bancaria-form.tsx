'use client'
export function TransferenciaBancariaForm({ onSuccess }: { onSuccess?: () => void }) {
  return <div className="p-6"><h2 className="text-lg font-semibold">Transferencia Bancaria</h2><p className="text-muted-foreground">Módulo en construcción</p><button onClick={onSuccess} className="mt-4 px-4 py-2 bg-primary text-white rounded">Ok</button></div>
}
