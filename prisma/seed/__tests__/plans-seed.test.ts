import { describe, expect, it } from 'vitest';

import {
  PLAN_BASICO_FEATURES,
  PLAN_EMPRESARIAL_FEATURES,
  PLAN_PROFESIONAL_FEATURES,
} from '../../seed/plans-seed';

describe('PLAN_BASICO_FEATURES', () => {
  it('mantiene gestión de empleados activa en Básico', () => {
    expect(PLAN_BASICO_FEATURES.empleados).toBe(true);
  });

  it('habilita reportes contables en Básico', () => {
    expect(PLAN_BASICO_FEATURES['reportes-financieros']).toBe(true);
  });

  it('oculta módulos separados de nómina, asistencia y vacaciones en Básico', () => {
    expect(PLAN_BASICO_FEATURES.nomina).toBe(false);
    expect(PLAN_BASICO_FEATURES.asistencia).toBe(false);
    expect(PLAN_BASICO_FEATURES.vacaciones).toBe(false);
  });

  it('solo habilita el upload del logo de empresa en Básico', () => {
    expect(PLAN_BASICO_FEATURES['upload-mi-empresa-logo']).toBe(true);
    expect(PLAN_BASICO_FEATURES['upload-clientes-logo']).toBe(false);
    expect(PLAN_BASICO_FEATURES['upload-vendors-logo']).toBe(false);
    expect(PLAN_BASICO_FEATURES['upload-profile-avatar']).toBe(false);
    expect(PLAN_BASICO_FEATURES['upload-productos-photo']).toBe(false);
    expect(PLAN_BASICO_FEATURES['upload-contratos-attachment']).toBe(false);
    expect(PLAN_BASICO_FEATURES['upload-contratos-version']).toBe(false);
  });
});

describe('upload entitlements by paid plan', () => {
  it('incluye CxC y CxP desde el plan Profesional', () => {
    expect(PLAN_PROFESIONAL_FEATURES['cuentas-cobrar']).toBe(true);
    expect(PLAN_PROFESIONAL_FEATURES['cuentas-pagar']).toBe(true);
  });

  it('habilita uploads Cloudinary operativos en Profesional', () => {
    expect(PLAN_PROFESIONAL_FEATURES['upload-clientes-logo']).toBe(true);
    expect(PLAN_PROFESIONAL_FEATURES['upload-vendors-logo']).toBe(true);
    expect(PLAN_PROFESIONAL_FEATURES['upload-profile-avatar']).toBe(true);
    expect(PLAN_PROFESIONAL_FEATURES['upload-deudas-cash-receipt']).toBe(true);
    expect(PLAN_PROFESIONAL_FEATURES['upload-productos-photo']).toBe(false);
  });

  it('reserva uploads de productos y contratos para Empresarial', () => {
    expect(PLAN_EMPRESARIAL_FEATURES['upload-productos-photo']).toBe(true);
    expect(PLAN_EMPRESARIAL_FEATURES['upload-contratos-attachment']).toBe(true);
    expect(PLAN_EMPRESARIAL_FEATURES['upload-contratos-version']).toBe(true);
  });
});
