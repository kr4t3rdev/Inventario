const PREFIJOS_BASE: Record<string, string> = {
  COMPRA_VENTA: 'CV',
  SERVICIO: 'SER',
  SUMINISTROS: 'SUM',
};

export function derivarPrefijoCustom(tipo: string): string {
  const normalizado = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  return normalizado.length === 3 ? normalizado : 'CUS';
}

export function generarPrefijo(tipo: string): string {
  return tipo in PREFIJOS_BASE ? PREFIJOS_BASE[tipo] : derivarPrefijoCustom(tipo);
}

export function formatearNumeroContrato(tipo: string, consecutivo: number): string {
  return `${generarPrefijo(tipo)}-${String(consecutivo).padStart(4, '0')}`;
}

export function validarFormatoNumeroContrato(numeroContrato: string): boolean {
  const [prefijo, numero] = numeroContrato.split('-');
  return Boolean(numero && /^\d{4}$/.test(numero) &&
    (['CV', 'SER', 'SUM'].includes(prefijo) || /^[A-Z0-9]{3}$/.test(prefijo)));
}

export function extraerTipoDelNumero(numeroContrato: string): string | null {
  return ({ CV: 'COMPRA_VENTA', SER: 'SERVICIO', SUM: 'SUMINISTROS' } as Record<string, string>)[numeroContrato.split('-')[0]] ?? null;
}
