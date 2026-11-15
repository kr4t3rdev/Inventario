/**
 * @description Dispatcher de webhooks con retry y HMAC verification.
 *
 * Envía eventos de lealtad a endpoints externos configurados
 * con verificación HMAC para seguridad.
 *
 * @module features/automatizacion/services/webhook-dispatcher
 */

import { createHmac } from 'crypto';

export interface WebhookDefinicion {
  webhookId: string;
  tenantId: string;
  url: string;
  eventos: string[];
  secreto: string;
  activo: boolean;
}

export interface WebhookPayload {
  evento: string;
  tenantId: string;
  clienteId: string;
  datos: Record<string, unknown>;
  timestamp: string;
}

export interface WebhookResultado {
  webhookId: string;
  url: string;
  exitoso: boolean;
  statusCode?: number;
  intentos: number;
  error?: string;
}

/**
 * @description Genera un HMAC-SHA256 signature para verificar la integridad del webhook.
 * Usa crypto.createHmac de Node.js (disponible en Next.js server runtime).
 * @param {string} payload - Cuerpo del webhook como string JSON.
 * @param {string} secreto - Secreto HMAC.
 * @returns {string} Signature en base64.
 */
export function generarHMACSignature(payload: string, secreto: string): string {
  return createHmac('sha256', secreto).update(payload).digest('base64');
}

/**
 * @description Verifica si un HMAC signature es válido.
 * @param {string} payload - Cuerpo del webhook.
 * @param {string} signature - Signature recibida.
 * @param {string} secreto - Secreto HMAC.
 * @returns {boolean} True si la signature es válida.
 */
export function verificarHMACSignature(
  payload: string,
  signature: string,
  secreto: string
): boolean {
  const expected = generarHMACSignature(payload, secreto);
  return expected === signature;
}

/**
 * @description Determina si un webhook debe dispararse para un evento.
 * @param {WebhookDefinicion} webhook - Definición del webhook.
 * @param {string} evento - Nombre del evento.
 * @returns {boolean} True si el webhook debe dispararse.
 */
export function debeDispararWebhook(webhook: WebhookDefinicion, evento: string): boolean {
  if (!webhook.activo) return false;
  return webhook.eventos.includes(evento);
}

/**
 * @description Crea el payload de un webhook.
 * @param {object} params - Datos del evento.
 * @returns {WebhookPayload} Payload del webhook.
 */
export function crearWebhookPayload(params: {
  evento: string;
  tenantId: string;
  clienteId: string;
  datos: Record<string, unknown>;
}): WebhookPayload {
  return {
    evento: params.evento,
    tenantId: params.tenantId,
    clienteId: params.clienteId,
    datos: params.datos,
    timestamp: new Date().toISOString(),
  };
}

/**
 * @description Envía un webhook HTTP real con retry y exponential backoff.
 * Usa fetch() disponible en Next.js server runtime.
 * @param {WebhookDefinicion} webhook - Definición del webhook.
 * @param {WebhookPayload} payload - Payload del webhook.
 * @param {number} maxIntentos - Máximo de intentos.
 * @returns {Promise<WebhookResultado>} Resultado del dispatch.
 */
export async function dispatchWebhook(
  webhook: WebhookDefinicion,
  payload: WebhookPayload,
  maxIntentos: number = 3
): Promise<WebhookResultado> {
  const payloadStr = JSON.stringify(payload);
  const signature = generarHMACSignature(payloadStr, webhook.secreto);

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        return {
          webhookId: webhook.webhookId,
          url: webhook.url,
          exitoso: true,
          statusCode: response.status,
          intentos: intento,
        };
      }

      if (intento < maxIntentos) {
        const delay = calcularRetryDelay(intento, 1000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      if (intento === maxIntentos) {
        return {
          webhookId: webhook.webhookId,
          url: webhook.url,
          exitoso: false,
          statusCode: undefined,
          intentos: intento,
          error: error instanceof Error ? error.message : 'Error desconocido',
        };
      }
      const delay = calcularRetryDelay(intento, 1000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    webhookId: webhook.webhookId,
    url: webhook.url,
    exitoso: false,
    intentos: maxIntentos,
    error: 'Se agotaron los intentos',
  };
}

/**
 * @description Calcula el delay de retry con exponential backoff.
 * @param {number} intento - Número de intento (1, 2, 3...).
 * @param {number} baseDelay - Delay base en ms.
 * @returns {number} Delay en ms.
 */
export function calcularRetryDelay(intento: number, baseDelay: number = 1000): number {
  return baseDelay * Math.pow(2, intento - 1);
}

/**
 * @description Filtra los webhooks activos para un evento específico.
 * @param {WebhookDefinicion[]} webhooks - Lista de webhooks.
 * @param {string} evento - Nombre del evento.
 * @param {string} tenantId - Tenant ID.
 * @returns {WebhookDefinicion[]} Webhooks que deben dispararse.
 */
export function filtrarWebhooksParaEvento(
  webhooks: WebhookDefinicion[],
  evento: string,
  tenantId: string
): WebhookDefinicion[] {
  return webhooks.filter(
    (w) => w.tenantId === tenantId && debeDispararWebhook(w, evento)
  );
}
