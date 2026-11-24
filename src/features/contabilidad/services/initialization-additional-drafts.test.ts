import { describe, expect, it } from 'vitest';
import {
  newInitialInventoryDraft,
  newInitialPayableDraft,
  newInitialReceivableDraft,
  toInitialInventoryDraft,
  toInitialPayableDraft,
  toInitialReceivableDraft,
} from './initialization-additional-drafts';

describe('borradores de secciones de apertura', () => {
  it('crea referencias únicas y moneda CUP por defecto', () => {
    const inventory = newInitialInventoryDraft();
    const receivable = newInitialReceivableDraft();
    const payable = newInitialPayableDraft();

    expect(new Set([
      inventory.referenciaFila,
      receivable.referenciaFila,
      payable.referenciaFila,
    ]).size).toBe(3);
    expect([inventory.moneda, receivable.moneda, payable.moneda]).toEqual(['CUP', 'CUP', 'CUP']);
  });

  it('normaliza borrador parcial de inventario sin perder lote y fecha', () => {
    expect(toInitialInventoryDraft({ loteCodigo: 'L-1', fechaVencimiento: '2027-01-01' }))
      .toMatchObject({
        loteCodigo: 'L-1',
        fechaVencimiento: '2027-01-01',
        productoId: '',
        moneda: 'CUP',
      });
  });

  it('normaliza CxC y conserva tasas de interés importadas', () => {
    expect(toInitialReceivableDraft({ saldo: '250', tasaInteres: '5', tasaInteresMoratorio: '8' }))
      .toMatchObject({
        saldo: '250',
        tasaInteres: '5',
        tasaInteresMoratorio: '8',
        moneda: 'CUP',
      });
  });

  it('acepta entrada inválida de CxP como borrador vacío y editable', () => {
    expect(toInitialPayableDraft(null)).toMatchObject({
      proveedorId: '',
      referenciaExterna: '',
      saldo: '',
      moneda: 'CUP',
    });
  });
});
