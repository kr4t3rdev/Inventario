//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

import 'package:tcp_mobile_v1_sdk/api.dart';
import 'package:test/test.dart';


/// tests for AdminApi
void main() {
  // final instance = AdminApi();

  group('tests for AdminApi', () {
    // Aprobar solicitud de membresía
    //
    // Aprueba una solicitud de membresía pendiente, activa al usuario, cierra su flujo de incorporación y crea su registro de empleado en la empresa cuando aún no existe.
    //
    //Future<PostAdminMembershipsApproveResponse> mobileApproveAdminMembership(ApproveAdminMembershipRequest approveAdminMembershipRequest) async
    test('test mobileApproveAdminMembership', () async {
      // TODO
    });

    // Consultar salud del sistema
    //
    // Devuelve métricas globales de la plataforma: total de usuarios reales por rol, empresas activas, sesiones vigentes y licencias con su estado de expiración. Incluye la tendencia de nuevos usuarios de los últimos 14 días con comparación entre semanas.
    //
    //Future<AdminHealthResponse> mobileGetAdminHealth() async
    test('test mobileGetAdminHealth', () async {
      // TODO
    });

    // Consultar métricas de licencias
    //
    // Resume las licencias totales, activas, expiradas, de demostración, de prueba de administración y las próximas a vencer en los próximos siete días, respetando los filtros de la lista paginada.
    //
    //Future<GetAdminLicenseStatsResponse> mobileGetAdminLicenseStats({ String search, String planFilter, String statusFilter, String typeFilter }) async
    test('test mobileGetAdminLicenseStats', () async {
      // TODO
    });

    // Listar licencias con filtros
    //
    // Consulta paginada de licencias con búsqueda por identificador, empresa o responsable, y filtros por plan, estado y tipo. Permite ordenar por fecha, expiración, actividad, empresa o plan.
    //
    //Future<GetAdminLicensesResponse> mobileGetAdminLicenses({ int page, int limit, String sortBy, String sortOrder, String search, String planFilter, String statusFilter, String typeFilter }) async
    test('test mobileGetAdminLicenses', () async {
      // TODO
    });

    // Listar solicitudes de membresía pendientes
    //
    // Enumerar las solicitudes de membresía que aguardan aprobación, con los datos del solicitante y la empresa destino, ordenadas de la más reciente a la más antigua.
    //
    //Future<List<PendingMembershipItem>> mobileGetAdminPendingMemberships() async
    test('test mobileGetAdminPendingMemberships', () async {
      // TODO
    });

    // Listar empresas de la plataforma
    //
    // Enumera las empresas reales de la plataforma, excluyendo las cuentas de demostración, con su plan vigente, estado de licencia y conteo de usuarios, productos y almacenes.
    //
    //Future<List<AdminTenantItem>> mobileGetAdminTenants() async
    test('test mobileGetAdminTenants', () async {
      // TODO
    });

    // Listar usuarios de la plataforma
    //
    // Lista los usuarios globales para el administrador de la plataforma o los integrantes de una empresa para un gestor. Permite acotar la consulta a una empresa mediante el identificador opcional.
    //
    //Future<GetAdminUsersResponse> mobileGetAdminUsers({ String tenantId, int limit }) async
    test('test mobileGetAdminUsers', () async {
      // TODO
    });

    // Bloquear usuario por 24 horas
    //
    // Bloquea temporalmente a un usuario de la plataforma durante 24 horas, previniendo nuevos inicios de sesión. Devuelve el estado actualizado del bloqueo y su mensaje de confirmación.
    //
    //Future<PostAdminUsersLockResponse> mobileLockAdminUser(LockAdminUserRequest lockAdminUserRequest) async
    test('test mobileLockAdminUser', () async {
      // TODO
    });

    // Rechazar solicitud de membresía
    //
    // Rechaza una solicitud de membresía pendiente, elimina la solicitud y devuelve al solicitante a la etapa de selección de empresa para que pueda volver a elegir.
    //
    //Future<PostAdminMembershipsRejectResponse> mobileRejectAdminMembership(RejectAdminMembershipRequest rejectAdminMembershipRequest) async
    test('test mobileRejectAdminMembership', () async {
      // TODO
    });

    // Desbloquear usuario
    //
    // Desbloquea a un usuario de la plataforma y reinicia sus intentos de inicio de sesión. Devuelve el estado actualizado y su mensaje de confirmación.
    //
    //Future<PostAdminUsersLockResponse> mobileUnlockAdminUser(UnlockAdminUserRequest unlockAdminUserRequest) async
    test('test mobileUnlockAdminUser', () async {
      // TODO
    });

  });
}
