/**
 * @description Tests unitarios para el webhook dispatcher.
 *
 * @module features/automatizacion/__tests__/webhook-dispatcher.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  generarHMACSignature,
  verificarHMACSignature,
  debeDispararWebhook,
  crearWebhookPayload,
  dispatchWebhookSimulado,
  calcularRetryDelay,
  filtrarWebhooksParaEvento,
} from '../services/webhook-dispatcher';
import type { WebhookDefinicion } from '../services/webhook-dispatcher';

describe('generarHMACSignature', () => {
  it('genera signature consistente', () => {
    const sig1 = generarHMACSignature('{"evento":"test"}', 'secret123');
    const sig2 = generarHMACSignature('{"evento":"test"}', 'secret123');
    expect(sig1).toBe(sig2);
  });

  it('genera signatures diferentes para payloads diferentes', () => {
    const sig1 = generarHMACSignature('{"evento":"test"}', 'secret123');
    const sig2 = generarHMACSignature('{"evento":"otro"}', 'secret123');
    expect(sig1).not.toBe(sig2);
  });

  it('genera signatures diferentes para secretos diferentes', () => {
    const sig1 = generarHMACSignature('{"evento":"test"}', 'secret1');
    const sig2 = generarHMACSignature('{"evento":"test"}', 'secret2');
    expect(sig1).not.toBe(sig2);
  });
});

describe('verificarHMACSignature', () => {
  it('verifica signature válida', () => {
    const payload = '{"evento":"test"}';
    const secreto = 'secret123';
    const signature = generarHMACSignature(payload, secreto);
    expect(verificarHMACSignature(payload, signature, secreto)).toBe(true);
  });

  it('rechaza signature inválida', () => {
    const payload = '{"evento":"test"}';
    const secreto = 'secret123';
    expect(verificarHMACSignature(payload, 'invalid-signature', secreto)).toBe(false);
  });
});

describe('debeDispararWebhook', () => {
  const webhook: WebhookDefinicion = {
    webhookId: 'w1',
    tenantId: 't1',
    url: 'https://example.com/webhook',
    eventos: ['puntos_acumulados', 'tier_cambiado'],
    secreto: 'secret',
    activo: true,
  };

  it('retorna true si el evento está en la lista', () => {
    expect(debeDispararWebhook(webhook, 'puntos_acumulados')).toBe(true);
  });

  it('retorna false si el evento no está en la lista', () => {
    expect(debeDispararWebhook(webhook, 'cupon_redimido')).toBe(false);
  });

  it('retorna false si el webhook está inactivo', () => {
    expect(debeDispararWebhook({ ...webhook, activo: false }, 'puntos_acumulados')).toBe(false);
  });
});

describe('crearWebhookPayload', () => {
  it('crea payload con todos los campos', () => {
    const payload = crearWebhookPayload({
      evento: 'puntos_acumulados',
      tenantId: 't1',
      clienteId: 'c1',
      datos: { puntos: 100 },
    });

    expect(payload.evento).toBe('puntos_acumulados');
    expect(payload.tenantId).toBe('t1');
    expect(payload.clienteId).toBe('c1');
    expect(payload.datos.puntos).toBe(100);
    expect(payload.timestamp).toBeDefined();
  });
});

describe('dispatchWebhookSimulado', () => {
  it('retorna resultado exitoso', () => {
    const webhook: WebhookDefinicion = {
      webhookId: 'w1',
      tenantId: 't1',
      url: 'https://example.com/webhook',
      eventos: ['test'],
      secreto: 'secret',
      activo: true,
    };

    const payload = crearWebhookPayload({
      evento: 'test',
      tenantId: 't1',
      clienteId: 'c1',
      datos: {},
    });

    const resultado = dispatchWebhookSimulado(webhook, payload);
    expect(resultado.exitoso).toBe(true);
    expect(resultado.statusCode).toBe(200);
    expect(resultado.intentos).toBe(1);
  });
});

describe('calcularRetryDelay', () => {
  it('calcula delay con exponential backoff', () => {
    expect(calcularRetryDelay(1, 1000)).toBe(1000);
    expect(calcularRetryDelay(2, 1000)).toBe(2000);
    expect(calcularRetryDelay(3, 1000)).toBe(4000);
    expect(calcularRetryDelay(4, 1000)).toBe(8000);
  });
});

describe('filtrarWebhooksParaEvento', () => {
  it('filtra webhooks por tenant y evento', () => {
    const webhooks: WebhookDefinicion[] = [
      {
        webhookId: 'w1',
        tenantId: 't1',
        url: 'https://example.com/w1',
        eventos: ['puntos_acumulados'],
        secreto: 's1',
        activo: true,
      },
      {
        webhookId: 'w2',
        tenantId: 't1',
        url: 'https://example.com/w2',
        eventos: ['tier_cambiado'],
        secreto: 's2',
        activo: true,
      },
      {
        webhookId: 'w3',
        tenantId: 't2',
        url: 'https://example.com/w3',
        eventos: ['puntos_acumulados'],
        secreto: 's3',
        activo: true,
      },
    ];

    const filtrados = filtrarWebhooksParaEvento(webhooks, 'puntos_acumulados', 't1');
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].webhookId).toBe('w1');
  });
});
