/**
 * @description Detección y fusión de clientes duplicados.
 *
 * Identifica clientes potencialmente duplicados por email, teléfono,
 * nombre y otros criterios. Proporciona herramientas para fusionar
 * registros manteniendo la integridad referencial.
 *
 * @module features/crm/services/deduplication-service
 */

export interface DuplicadoCriterios {
  email?: boolean;
  telefono?: boolean;
  nombre?: boolean;
  direccion?: boolean;
  taxId?: boolean;
}

export interface ClienteComparar {
  clienteId: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  taxIdCliente: string | null;
}

export interface DuplicadoEncontrado {
  clienteA: ClienteComparar;
  clienteB: ClienteComparar;
  criteriosMatch: DuplicadoCriterios;
  similitud: number; // 0-100
}

/**
 * @description Normaliza un string para comparación: lowercase, trim,
 * eliminar acentos y caracteres especiales.
 * @param {string | null | undefined} str - String a normalizar.
 * @returns {string} String normalizado.
 */
function normalize(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * @description Calcula la similitud entre dos strings usando
 * una métrica simple basada en caracteres comunes.
 * @param {string} a - Primer string.
 * @param {string} b - Segundo string.
 * @returns {number} Porcentaje de similitud (0-100).
 */
function stringSimilitud(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);

  if (!normA && !normB) return 100;
  if (!normA || !normB) return 0;
  if (normA === normB) return 100;

  // Similitud básica: caracteres compartidos / max(longitud)
  const longer = normA.length > normB.length ? normA : normB;
  const shorter = normA.length > normB.length ? normB : normA;

  let matches = 0;
  for (const char of shorter) {
    if (longer.includes(char)) {
      matches++;
    }
  }

  return Math.round((matches / longer.length) * 100);
}

/**
 * @description Detecta si dos clientes son potencialmente duplicados
 * según los criterios especificados.
 * @param {ClienteComparar} clienteA - Primer cliente.
 * @param {ClienteComparar} clienteB - Segundo cliente.
 * @param {DuplicadoCriterios} criterios - Campos a comparar.
 * @returns {DuplicadoEncontrado | null} Duplicado encontrado o null.
 */
export function detectarDuplicado(
  clienteA: ClienteComparar,
  clienteB: ClienteComparar,
  criterios: DuplicadoCriterios = { email: true, telefono: true, nombre: true },
): DuplicadoEncontrado | null {
  // No comparar un cliente consigo mismo
  if (clienteA.clienteId === clienteB.clienteId) return null;

  const criteriosMatch: DuplicadoCriterios = {};
  let totalSimilitud = 0;
  let criteriosHit = 0;

  // Email: match exacto
  if (criterios.email) {
    const emailA = normalize(clienteA.email);
    const emailB = normalize(clienteB.email);
    if (emailA && emailB && emailA === emailB) {
      criteriosMatch.email = true;
      criteriosHit++;
      totalSimilitud += 100;
    }
  }

  // Teléfono: match exacto
  if (criterios.telefono) {
    const telA = normalize(clienteA.telefono);
    const telB = normalize(clienteB.telefono);
    if (telA && telB && telA === telB) {
      criteriosMatch.telefono = true;
      criteriosHit++;
      totalSimilitud += 100;
    }
  }

  // Nombre: similitud alta
  if (criterios.nombre) {
    const sim = stringSimilitud(clienteA.nombre, clienteB.nombre);
    if (sim >= 80) {
      criteriosMatch.nombre = true;
      criteriosHit++;
      totalSimilitud += sim;
    }
  }

  // Dirección: similitud alta
  if (criterios.direccion) {
    const sim = stringSimilitud(clienteA.direccion ?? '', clienteB.direccion ?? '');
    if (sim >= 70) {
      criteriosMatch.direccion = true;
      criteriosHit++;
      totalSimilitud += sim;
    }
  }

  // Tax ID: match exacto
  if (criterios.taxId) {
    const taxA = normalize(clienteA.taxIdCliente);
    const taxB = normalize(clienteB.taxIdCliente);
    if (taxA && taxB && taxA === taxB) {
      criteriosMatch.taxId = true;
      criteriosHit++;
      totalSimilitud += 100;
    }
  }

  // Si al menos 2 criterios coinciden, es un duplicado potencial
  if (criteriosHit >= 2) {
    const criteriosCount = Object.keys(criterios).filter((k) => criterios[k as keyof DuplicadoCriterios]).length;
    const similitud = Math.round(totalSimilitud / criteriosCount);
    return { clienteA, clienteB, criteriosMatch, similitud };
  }

  return null;
}

/**
 * @description Encuentra todos los duplicados potenciales en una lista de clientes.
 * @param {ClienteComparar[]} clientes - Lista de clientes a comparar.
 * @param {DuplicadoCriterios} criterios - Criterios de comparación.
 * @returns {DuplicadoEncontrado[]} Lista de duplicados encontrados.
 */
export function encontrarDuplicados(
  clientes: ClienteComparar[],
  criterios: DuplicadoCriterios = { email: true, telefono: true, nombre: true },
): DuplicadoEncontrado[] {
  const duplicados: DuplicadoEncontrado[] = [];

  for (let i = 0; i < clientes.length; i++) {
    for (let j = i + 1; j < clientes.length; j++) {
      const duplicado = detectarDuplicado(clientes[i], clientes[j], criterios);
      if (duplicado) {
        duplicados.push(duplicado);
      }
    }
  }

  return duplicados;
}

/**
 * @description Determina cuál cliente es el "principal" en una fusión.
 * El principal es el que tiene más datos completos y más compras.
 * @param {ClienteComparar} clienteA - Primer cliente.
 * @param {ClienteComparar} clienteB - Segundo cliente.
 * @param {object} scores - Scores de cada cliente.
 * @param {number} scores.comprasA - Compras de A.
 * @param {number} scores.comprasB - Compras de B.
 * @param {number} scores.gastadoA - Gastado por A.
 * @param {number} scores.gastadoB - Gastado por B.
 * @returns {"A" | "B"} El cliente ganador.
 */
export function determinarClientePrincipal(
  _clienteA: ClienteComparar,
  _clienteB: ClienteComparar,
  scores: { comprasA: number; comprasB: number; gastadoA: number; gastadoB: number },
): 'A' | 'B' {
  // Priorizar por gasto total
  if (scores.gastadoA > scores.gastadoB) return 'A';
  if (scores.gastadoB > scores.gastadoA) return 'B';

  // Tie-break por cantidad de compras
  if (scores.comprasA > scores.comprasB) return 'A';
  if (scores.comprasB > scores.comprasA) return 'B';

  // Tie-break final: el que tiene más campos llenos
  const camposA = [
    _clienteA.nombre,
    _clienteA.email,
    _clienteA.telefono,
    _clienteA.direccion,
    _clienteA.taxIdCliente,
  ].filter(Boolean).length;

  const camposB = [
    _clienteB.nombre,
    _clienteB.email,
    _clienteB.telefono,
    _clienteB.direccion,
    _clienteB.taxIdCliente,
  ].filter(Boolean).length;

  return camposA >= camposB ? 'A' : 'B';
}

/**
 * @description Genera los datos fusionados de dos clientes.
 * El cliente principal mantiene su ID; los campos del secundario
 * se mergen si están vacíos en el principal.
 * @param {ClienteComparar} principal - Cliente que se mantiene.
 * @param {ClienteComparar} secundario - Cliente que se fusiona.
 * @returns {Partial<ClienteComparar>} Datos actualizados del principal.
 */
export function generarDatosFusionados(
  principal: ClienteComparar,
  secundario: ClienteComparar,
): Partial<ClienteComparar> {
  return {
    nombre: principal.nombre || secundario.nombre,
    email: principal.email || secundario.email,
    telefono: principal.telefono || secundario.telefono,
    direccion: principal.direccion || secundario.direccion,
    taxIdCliente: principal.taxIdCliente || secundario.taxIdCliente,
  };
}
