//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class AdminApi {
  AdminApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Aprobar solicitud de membresía
  ///
  /// Aprueba una solicitud de membresía pendiente, activa al usuario, cierra su flujo de incorporación y crea su registro de empleado en la empresa cuando aún no existe.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [ApproveAdminMembershipRequest] approveAdminMembershipRequest (required):
  Future<Response> mobileApproveAdminMembershipWithHttpInfo(ApproveAdminMembershipRequest approveAdminMembershipRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/memberships/approve';

    // ignore: prefer_final_locals
    Object? postBody = approveAdminMembershipRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'POST',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Aprobar solicitud de membresía
  ///
  /// Aprueba una solicitud de membresía pendiente, activa al usuario, cierra su flujo de incorporación y crea su registro de empleado en la empresa cuando aún no existe.
  ///
  /// Parameters:
  ///
  /// * [ApproveAdminMembershipRequest] approveAdminMembershipRequest (required):
  Future<PostAdminMembershipsApproveResponse?> mobileApproveAdminMembership(ApproveAdminMembershipRequest approveAdminMembershipRequest,) async {
    final response = await mobileApproveAdminMembershipWithHttpInfo(approveAdminMembershipRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminMembershipsApproveResponse',) as PostAdminMembershipsApproveResponse;
    
    }
    return null;
  }

  /// Consultar salud del sistema
  ///
  /// Devuelve métricas globales de la plataforma: total de usuarios reales por rol, empresas activas, sesiones vigentes y licencias con su estado de expiración. Incluye la tendencia de nuevos usuarios de los últimos 14 días con comparación entre semanas.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAdminHealthWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/admin/health';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Consultar salud del sistema
  ///
  /// Devuelve métricas globales de la plataforma: total de usuarios reales por rol, empresas activas, sesiones vigentes y licencias con su estado de expiración. Incluye la tendencia de nuevos usuarios de los últimos 14 días con comparación entre semanas.
  Future<AdminHealthResponse?> mobileGetAdminHealth() async {
    final response = await mobileGetAdminHealthWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'AdminHealthResponse',) as AdminHealthResponse;
    
    }
    return null;
  }

  /// Consultar métricas de licencias
  ///
  /// Resume las licencias totales, activas, expiradas, de demostración, de prueba de administración y las próximas a vencer en los próximos siete días, respetando los filtros de la lista paginada.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] search:
  ///   Búsqueda por identificador, empresa o responsable.
  ///
  /// * [String] planFilter:
  ///   Filtro por plan.
  ///
  /// * [String] statusFilter:
  ///   Filtro por estado.
  ///
  /// * [String] typeFilter:
  ///   Filtro por tipo.
  Future<Response> mobileGetAdminLicenseStatsWithHttpInfo({ String? search, String? planFilter, String? statusFilter, String? typeFilter, }) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/licenses/stats';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (search != null) {
      queryParams.addAll(_queryParams('', 'search', search));
    }
    if (planFilter != null) {
      queryParams.addAll(_queryParams('', 'planFilter', planFilter));
    }
    if (statusFilter != null) {
      queryParams.addAll(_queryParams('', 'statusFilter', statusFilter));
    }
    if (typeFilter != null) {
      queryParams.addAll(_queryParams('', 'typeFilter', typeFilter));
    }

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Consultar métricas de licencias
  ///
  /// Resume las licencias totales, activas, expiradas, de demostración, de prueba de administración y las próximas a vencer en los próximos siete días, respetando los filtros de la lista paginada.
  ///
  /// Parameters:
  ///
  /// * [String] search:
  ///   Búsqueda por identificador, empresa o responsable.
  ///
  /// * [String] planFilter:
  ///   Filtro por plan.
  ///
  /// * [String] statusFilter:
  ///   Filtro por estado.
  ///
  /// * [String] typeFilter:
  ///   Filtro por tipo.
  Future<GetAdminLicenseStatsResponse?> mobileGetAdminLicenseStats({ String? search, String? planFilter, String? statusFilter, String? typeFilter, }) async {
    final response = await mobileGetAdminLicenseStatsWithHttpInfo( search: search, planFilter: planFilter, statusFilter: statusFilter, typeFilter: typeFilter, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAdminLicenseStatsResponse',) as GetAdminLicenseStatsResponse;
    
    }
    return null;
  }

  /// Listar licencias con filtros
  ///
  /// Consulta paginada de licencias con búsqueda por identificador, empresa o responsable, y filtros por plan, estado y tipo. Permite ordenar por fecha, expiración, actividad, empresa o plan.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [int] page:
  ///   Número de página.
  ///
  /// * [int] limit:
  ///   Elementos por página.
  ///
  /// * [String] sortBy:
  ///   Campo de ordenamiento.
  ///
  /// * [String] sortOrder:
  ///   Dirección del ordenamiento.
  ///
  /// * [String] search:
  ///   Búsqueda por identificador, empresa o responsable.
  ///
  /// * [String] planFilter:
  ///   Filtro por plan.
  ///
  /// * [String] statusFilter:
  ///   Filtro por estado.
  ///
  /// * [String] typeFilter:
  ///   Filtro por tipo.
  Future<Response> mobileGetAdminLicensesWithHttpInfo({ int? page, int? limit, String? sortBy, String? sortOrder, String? search, String? planFilter, String? statusFilter, String? typeFilter, }) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/licenses';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
    }
    if (sortBy != null) {
      queryParams.addAll(_queryParams('', 'sortBy', sortBy));
    }
    if (sortOrder != null) {
      queryParams.addAll(_queryParams('', 'sortOrder', sortOrder));
    }
    if (search != null) {
      queryParams.addAll(_queryParams('', 'search', search));
    }
    if (planFilter != null) {
      queryParams.addAll(_queryParams('', 'planFilter', planFilter));
    }
    if (statusFilter != null) {
      queryParams.addAll(_queryParams('', 'statusFilter', statusFilter));
    }
    if (typeFilter != null) {
      queryParams.addAll(_queryParams('', 'typeFilter', typeFilter));
    }

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Listar licencias con filtros
  ///
  /// Consulta paginada de licencias con búsqueda por identificador, empresa o responsable, y filtros por plan, estado y tipo. Permite ordenar por fecha, expiración, actividad, empresa o plan.
  ///
  /// Parameters:
  ///
  /// * [int] page:
  ///   Número de página.
  ///
  /// * [int] limit:
  ///   Elementos por página.
  ///
  /// * [String] sortBy:
  ///   Campo de ordenamiento.
  ///
  /// * [String] sortOrder:
  ///   Dirección del ordenamiento.
  ///
  /// * [String] search:
  ///   Búsqueda por identificador, empresa o responsable.
  ///
  /// * [String] planFilter:
  ///   Filtro por plan.
  ///
  /// * [String] statusFilter:
  ///   Filtro por estado.
  ///
  /// * [String] typeFilter:
  ///   Filtro por tipo.
  Future<GetAdminLicensesResponse?> mobileGetAdminLicenses({ int? page, int? limit, String? sortBy, String? sortOrder, String? search, String? planFilter, String? statusFilter, String? typeFilter, }) async {
    final response = await mobileGetAdminLicensesWithHttpInfo( page: page, limit: limit, sortBy: sortBy, sortOrder: sortOrder, search: search, planFilter: planFilter, statusFilter: statusFilter, typeFilter: typeFilter, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAdminLicensesResponse',) as GetAdminLicensesResponse;
    
    }
    return null;
  }

  /// Listar solicitudes de membresía pendientes
  ///
  /// Enumerar las solicitudes de membresía que aguardan aprobación, con los datos del solicitante y la empresa destino, ordenadas de la más reciente a la más antigua.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAdminPendingMembershipsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/admin/memberships/pending';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Listar solicitudes de membresía pendientes
  ///
  /// Enumerar las solicitudes de membresía que aguardan aprobación, con los datos del solicitante y la empresa destino, ordenadas de la más reciente a la más antigua.
  Future<List<PendingMembershipItem>?> mobileGetAdminPendingMemberships() async {
    final response = await mobileGetAdminPendingMembershipsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      final responseBody = await _decodeBodyBytes(response);
      return (await apiClient.deserializeAsync(responseBody, 'List<PendingMembershipItem>') as List)
        .cast<PendingMembershipItem>()
        .toList(growable: false);

    }
    return null;
  }

  /// Listar empresas de la plataforma
  ///
  /// Enumera las empresas reales de la plataforma, excluyendo las cuentas de demostración, con su plan vigente, estado de licencia y conteo de usuarios, productos y almacenes.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAdminTenantsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Listar empresas de la plataforma
  ///
  /// Enumera las empresas reales de la plataforma, excluyendo las cuentas de demostración, con su plan vigente, estado de licencia y conteo de usuarios, productos y almacenes.
  Future<List<AdminTenantItem>?> mobileGetAdminTenants() async {
    final response = await mobileGetAdminTenantsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      final responseBody = await _decodeBodyBytes(response);
      return (await apiClient.deserializeAsync(responseBody, 'List<AdminTenantItem>') as List)
        .cast<AdminTenantItem>()
        .toList(growable: false);

    }
    return null;
  }

  /// Listar usuarios de la plataforma
  ///
  /// Lista los usuarios globales para el administrador de la plataforma o los integrantes de una empresa para un gestor. Permite acotar la consulta a una empresa mediante el identificador opcional.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] tenantId:
  ///   Identificador de la empresa para acotar la consulta.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de usuarios.
  Future<Response> mobileGetAdminUsersWithHttpInfo({ String? tenantId, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (tenantId != null) {
      queryParams.addAll(_queryParams('', 'tenantId', tenantId));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
    }

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Listar usuarios de la plataforma
  ///
  /// Lista los usuarios globales para el administrador de la plataforma o los integrantes de una empresa para un gestor. Permite acotar la consulta a una empresa mediante el identificador opcional.
  ///
  /// Parameters:
  ///
  /// * [String] tenantId:
  ///   Identificador de la empresa para acotar la consulta.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de usuarios.
  Future<GetAdminUsersResponse?> mobileGetAdminUsers({ String? tenantId, int? limit, }) async {
    final response = await mobileGetAdminUsersWithHttpInfo( tenantId: tenantId, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAdminUsersResponse',) as GetAdminUsersResponse;
    
    }
    return null;
  }

  /// Bloquear usuario por 24 horas
  ///
  /// Bloquea temporalmente a un usuario de la plataforma durante 24 horas, previniendo nuevos inicios de sesión. Devuelve el estado actualizado del bloqueo y su mensaje de confirmación.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [LockAdminUserRequest] lockAdminUserRequest (required):
  Future<Response> mobileLockAdminUserWithHttpInfo(LockAdminUserRequest lockAdminUserRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/lock';

    // ignore: prefer_final_locals
    Object? postBody = lockAdminUserRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'POST',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Bloquear usuario por 24 horas
  ///
  /// Bloquea temporalmente a un usuario de la plataforma durante 24 horas, previniendo nuevos inicios de sesión. Devuelve el estado actualizado del bloqueo y su mensaje de confirmación.
  ///
  /// Parameters:
  ///
  /// * [LockAdminUserRequest] lockAdminUserRequest (required):
  Future<PostAdminUsersLockResponse?> mobileLockAdminUser(LockAdminUserRequest lockAdminUserRequest,) async {
    final response = await mobileLockAdminUserWithHttpInfo(lockAdminUserRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminUsersLockResponse',) as PostAdminUsersLockResponse;
    
    }
    return null;
  }

  /// Rechazar solicitud de membresía
  ///
  /// Rechaza una solicitud de membresía pendiente, elimina la solicitud y devuelve al solicitante a la etapa de selección de empresa para que pueda volver a elegir.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [RejectAdminMembershipRequest] rejectAdminMembershipRequest (required):
  Future<Response> mobileRejectAdminMembershipWithHttpInfo(RejectAdminMembershipRequest rejectAdminMembershipRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/memberships/reject';

    // ignore: prefer_final_locals
    Object? postBody = rejectAdminMembershipRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'POST',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Rechazar solicitud de membresía
  ///
  /// Rechaza una solicitud de membresía pendiente, elimina la solicitud y devuelve al solicitante a la etapa de selección de empresa para que pueda volver a elegir.
  ///
  /// Parameters:
  ///
  /// * [RejectAdminMembershipRequest] rejectAdminMembershipRequest (required):
  Future<PostAdminMembershipsRejectResponse?> mobileRejectAdminMembership(RejectAdminMembershipRequest rejectAdminMembershipRequest,) async {
    final response = await mobileRejectAdminMembershipWithHttpInfo(rejectAdminMembershipRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminMembershipsRejectResponse',) as PostAdminMembershipsRejectResponse;
    
    }
    return null;
  }

  /// Desbloquear usuario
  ///
  /// Desbloquea a un usuario de la plataforma y reinicia sus intentos de inicio de sesión. Devuelve el estado actualizado y su mensaje de confirmación.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [UnlockAdminUserRequest] unlockAdminUserRequest (required):
  Future<Response> mobileUnlockAdminUserWithHttpInfo(UnlockAdminUserRequest unlockAdminUserRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/unlock';

    // ignore: prefer_final_locals
    Object? postBody = unlockAdminUserRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'POST',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Desbloquear usuario
  ///
  /// Desbloquea a un usuario de la plataforma y reinicia sus intentos de inicio de sesión. Devuelve el estado actualizado y su mensaje de confirmación.
  ///
  /// Parameters:
  ///
  /// * [UnlockAdminUserRequest] unlockAdminUserRequest (required):
  Future<PostAdminUsersLockResponse?> mobileUnlockAdminUser(UnlockAdminUserRequest unlockAdminUserRequest,) async {
    final response = await mobileUnlockAdminUserWithHttpInfo(unlockAdminUserRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminUsersLockResponse',) as PostAdminUsersLockResponse;
    
    }
    return null;
  }
}
