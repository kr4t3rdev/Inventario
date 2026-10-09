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

  /// Activar una licencia
  ///
  /// Activa una licencia desactivada de una empresa, restituyendo el acceso a sus usuarios dentro del período de vigencia.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminLicenciaIdRequest] adminLicenciaIdRequest (required):
  Future<Response> mobileActivateAdminLicenseWithHttpInfo(AdminLicenciaIdRequest adminLicenciaIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/licenses/activate';

    // ignore: prefer_final_locals
    Object? postBody = adminLicenciaIdRequest;

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

  /// Activar una licencia
  ///
  /// Activa una licencia desactivada de una empresa, restituyendo el acceso a sus usuarios dentro del período de vigencia.
  ///
  /// Parameters:
  ///
  /// * [AdminLicenciaIdRequest] adminLicenciaIdRequest (required):
  Future<PostAdminLicensesActivateResponse?> mobileActivateAdminLicense(AdminLicenciaIdRequest adminLicenciaIdRequest,) async {
    final response = await mobileActivateAdminLicenseWithHttpInfo(adminLicenciaIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminLicensesActivateResponse',) as PostAdminLicensesActivateResponse;
    
    }
    return null;
  }

  /// Activar una empresa
  ///
  /// Activa una empresa reactivando todas sus membresías, restituyendo el acceso de sus miembros. No modifica las licencias.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminTenantIdRequest] adminTenantIdRequest (required):
  Future<Response> mobileActivateAdminTenantWithHttpInfo(AdminTenantIdRequest adminTenantIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/activate';

    // ignore: prefer_final_locals
    Object? postBody = adminTenantIdRequest;

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

  /// Activar una empresa
  ///
  /// Activa una empresa reactivando todas sus membresías, restituyendo el acceso de sus miembros. No modifica las licencias.
  ///
  /// Parameters:
  ///
  /// * [AdminTenantIdRequest] adminTenantIdRequest (required):
  Future<PostAdminTenantsActivateResponse?> mobileActivateAdminTenant(AdminTenantIdRequest adminTenantIdRequest,) async {
    final response = await mobileActivateAdminTenantWithHttpInfo(adminTenantIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminTenantsActivateResponse',) as PostAdminTenantsActivateResponse;
    
    }
    return null;
  }

  /// Activar un usuario
  ///
  /// Reactiva el acceso de un usuario desactivado, limpiando además cualquier bloqueo temporal y los intentos fallidos de inicio de sesión acumulados.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<Response> mobileActivateAdminUserWithHttpInfo(AdminUserIdRequest adminUserIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/activate';

    // ignore: prefer_final_locals
    Object? postBody = adminUserIdRequest;

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

  /// Activar un usuario
  ///
  /// Reactiva el acceso de un usuario desactivado, limpiando además cualquier bloqueo temporal y los intentos fallidos de inicio de sesión acumulados.
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<PostAdminUsersActivateResponse?> mobileActivateAdminUser(AdminUserIdRequest adminUserIdRequest,) async {
    final response = await mobileActivateAdminUserWithHttpInfo(adminUserIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminUsersActivateResponse',) as PostAdminUsersActivateResponse;
    
    }
    return null;
  }

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

  /// Asignar una licencia a una empresa
  ///
  /// Crea una licencia nueva para la empresa con el plan indicado, desactivando las licencias vigentes anteriores para evitar ambigüedad. Calcula inicio y vencimiento desde la duración del plan.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AssignAdminTenantLicenseRequest] assignAdminTenantLicenseRequest (required):
  Future<Response> mobileAssignAdminTenantLicenseWithHttpInfo(AssignAdminTenantLicenseRequest assignAdminTenantLicenseRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/license/assign';

    // ignore: prefer_final_locals
    Object? postBody = assignAdminTenantLicenseRequest;

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

  /// Asignar una licencia a una empresa
  ///
  /// Crea una licencia nueva para la empresa con el plan indicado, desactivando las licencias vigentes anteriores para evitar ambigüedad. Calcula inicio y vencimiento desde la duración del plan.
  ///
  /// Parameters:
  ///
  /// * [AssignAdminTenantLicenseRequest] assignAdminTenantLicenseRequest (required):
  Future<PostAdminTenantsLicenseAssignResponse?> mobileAssignAdminTenantLicense(AssignAdminTenantLicenseRequest assignAdminTenantLicenseRequest,) async {
    final response = await mobileAssignAdminTenantLicenseWithHttpInfo(assignAdminTenantLicenseRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminTenantsLicenseAssignResponse',) as PostAdminTenantsLicenseAssignResponse;
    
    }
    return null;
  }

  /// Asignar o cambiar la empresa de un usuario
  ///
  /// Crea o actualiza la membresía de un usuario en una empresa con el rol operativo indicado. Puede desactivar las demás membresías para efectuar un cambio de empresa.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AssignAdminUserTenantRequest] assignAdminUserTenantRequest (required):
  Future<Response> mobileAssignAdminUserTenantWithHttpInfo(AssignAdminUserTenantRequest assignAdminUserTenantRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/assign-tenant';

    // ignore: prefer_final_locals
    Object? postBody = assignAdminUserTenantRequest;

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

  /// Asignar o cambiar la empresa de un usuario
  ///
  /// Crea o actualiza la membresía de un usuario en una empresa con el rol operativo indicado. Puede desactivar las demás membresías para efectuar un cambio de empresa.
  ///
  /// Parameters:
  ///
  /// * [AssignAdminUserTenantRequest] assignAdminUserTenantRequest (required):
  Future<PostAdminUsersAssignTenantResponse?> mobileAssignAdminUserTenant(AssignAdminUserTenantRequest assignAdminUserTenantRequest,) async {
    final response = await mobileAssignAdminUserTenantWithHttpInfo(assignAdminUserTenantRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminUsersAssignTenantResponse',) as PostAdminUsersAssignTenantResponse;
    
    }
    return null;
  }

  /// Cambiar el rol de un usuario dentro de una empresa
  ///
  /// Actualiza el rol operativo (manager, economico o dependiente) de la membresía existente de un usuario en una empresa.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [ChangeAdminUserTenantRoleRequest] changeAdminUserTenantRoleRequest (required):
  Future<Response> mobileChangeAdminUserTenantRoleWithHttpInfo(ChangeAdminUserTenantRoleRequest changeAdminUserTenantRoleRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/change-tenant-role';

    // ignore: prefer_final_locals
    Object? postBody = changeAdminUserTenantRoleRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'PATCH',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Cambiar el rol de un usuario dentro de una empresa
  ///
  /// Actualiza el rol operativo (manager, economico o dependiente) de la membresía existente de un usuario en una empresa.
  ///
  /// Parameters:
  ///
  /// * [ChangeAdminUserTenantRoleRequest] changeAdminUserTenantRoleRequest (required):
  Future<PatchAdminUsersChangeTenantRoleResponse?> mobileChangeAdminUserTenantRole(ChangeAdminUserTenantRoleRequest changeAdminUserTenantRoleRequest,) async {
    final response = await mobileChangeAdminUserTenantRoleWithHttpInfo(changeAdminUserTenantRoleRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PatchAdminUsersChangeTenantRoleResponse',) as PatchAdminUsersChangeTenantRoleResponse;
    
    }
    return null;
  }

  /// Desactivar una licencia
  ///
  /// Desactiva una licencia activa de una empresa, suspendiendo el acceso de sus usuarios hasta que se reactive o renueve.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminLicenciaIdRequest] adminLicenciaIdRequest (required):
  Future<Response> mobileDeactivateAdminLicenseWithHttpInfo(AdminLicenciaIdRequest adminLicenciaIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/licenses/deactivate';

    // ignore: prefer_final_locals
    Object? postBody = adminLicenciaIdRequest;

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

  /// Desactivar una licencia
  ///
  /// Desactiva una licencia activa de una empresa, suspendiendo el acceso de sus usuarios hasta que se reactive o renueve.
  ///
  /// Parameters:
  ///
  /// * [AdminLicenciaIdRequest] adminLicenciaIdRequest (required):
  Future<PostAdminLicensesDeactivateResponse?> mobileDeactivateAdminLicense(AdminLicenciaIdRequest adminLicenciaIdRequest,) async {
    final response = await mobileDeactivateAdminLicenseWithHttpInfo(adminLicenciaIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminLicensesDeactivateResponse',) as PostAdminLicensesDeactivateResponse;
    
    }
    return null;
  }

  /// Desactivar una empresa
  ///
  /// Desactiva una empresa bloqueando el acceso de todos sus miembros al desactivar sus membresías. No modifica las licencias.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminTenantIdRequest] adminTenantIdRequest (required):
  Future<Response> mobileDeactivateAdminTenantWithHttpInfo(AdminTenantIdRequest adminTenantIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/deactivate';

    // ignore: prefer_final_locals
    Object? postBody = adminTenantIdRequest;

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

  /// Desactivar una empresa
  ///
  /// Desactiva una empresa bloqueando el acceso de todos sus miembros al desactivar sus membresías. No modifica las licencias.
  ///
  /// Parameters:
  ///
  /// * [AdminTenantIdRequest] adminTenantIdRequest (required):
  Future<PostAdminTenantsDeactivateResponse?> mobileDeactivateAdminTenant(AdminTenantIdRequest adminTenantIdRequest,) async {
    final response = await mobileDeactivateAdminTenantWithHttpInfo(adminTenantIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminTenantsDeactivateResponse',) as PostAdminTenantsDeactivateResponse;
    
    }
    return null;
  }

  /// Desactivar la licencia de una empresa
  ///
  /// Desactiva una licencia específica de una empresa, suspendiendo el acceso asociado hasta que se reactive o renueve.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminLicenciaIdRequest] adminLicenciaIdRequest (required):
  Future<Response> mobileDeactivateAdminTenantLicenseWithHttpInfo(AdminLicenciaIdRequest adminLicenciaIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/license/deactivate';

    // ignore: prefer_final_locals
    Object? postBody = adminLicenciaIdRequest;

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

  /// Desactivar la licencia de una empresa
  ///
  /// Desactiva una licencia específica de una empresa, suspendiendo el acceso asociado hasta que se reactive o renueve.
  ///
  /// Parameters:
  ///
  /// * [AdminLicenciaIdRequest] adminLicenciaIdRequest (required):
  Future<PostAdminTenantsLicenseDeactivateResponse?> mobileDeactivateAdminTenantLicense(AdminLicenciaIdRequest adminLicenciaIdRequest,) async {
    final response = await mobileDeactivateAdminTenantLicenseWithHttpInfo(adminLicenciaIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminTenantsLicenseDeactivateResponse',) as PostAdminTenantsLicenseDeactivateResponse;
    
    }
    return null;
  }

  /// Desactivar un usuario
  ///
  /// Desactiva el acceso de un usuario y revoca de inmediato todas sus sesiones activas. No permite desactivar la propia cuenta ni al último administrador activo de la plataforma.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<Response> mobileDeactivateAdminUserWithHttpInfo(AdminUserIdRequest adminUserIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/deactivate';

    // ignore: prefer_final_locals
    Object? postBody = adminUserIdRequest;

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

  /// Desactivar un usuario
  ///
  /// Desactiva el acceso de un usuario y revoca de inmediato todas sus sesiones activas. No permite desactivar la propia cuenta ni al último administrador activo de la plataforma.
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<PostAdminUsersDeactivateResponse?> mobileDeactivateAdminUser(AdminUserIdRequest adminUserIdRequest,) async {
    final response = await mobileDeactivateAdminUserWithHttpInfo(adminUserIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminUsersDeactivateResponse',) as PostAdminUsersDeactivateResponse;
    
    }
    return null;
  }

  /// Eliminar una licencia
  ///
  /// Elimina permanentemente una licencia de una empresa. Es una operación irreversible: la empresa queda sin licencia hasta que se le asigne una nueva.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminLicenciaIdRequest] adminLicenciaIdRequest (required):
  Future<Response> mobileDeleteAdminLicenseWithHttpInfo(AdminLicenciaIdRequest adminLicenciaIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/licenses/delete';

    // ignore: prefer_final_locals
    Object? postBody = adminLicenciaIdRequest;

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

  /// Eliminar una licencia
  ///
  /// Elimina permanentemente una licencia de una empresa. Es una operación irreversible: la empresa queda sin licencia hasta que se le asigne una nueva.
  ///
  /// Parameters:
  ///
  /// * [AdminLicenciaIdRequest] adminLicenciaIdRequest (required):
  Future<PostAdminLicensesDeleteResponse?> mobileDeleteAdminLicense(AdminLicenciaIdRequest adminLicenciaIdRequest,) async {
    final response = await mobileDeleteAdminLicenseWithHttpInfo(adminLicenciaIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminLicensesDeleteResponse',) as PostAdminLicensesDeleteResponse;
    
    }
    return null;
  }

  /// Eliminar una empresa
  ///
  /// Elimina permanentemente una empresa y todos sus datos asociados. Es una operación irreversible.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminTenantIdRequest] adminTenantIdRequest (required):
  Future<Response> mobileDeleteAdminTenantWithHttpInfo(AdminTenantIdRequest adminTenantIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/delete';

    // ignore: prefer_final_locals
    Object? postBody = adminTenantIdRequest;

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

  /// Eliminar una empresa
  ///
  /// Elimina permanentemente una empresa y todos sus datos asociados. Es una operación irreversible.
  ///
  /// Parameters:
  ///
  /// * [AdminTenantIdRequest] adminTenantIdRequest (required):
  Future<PostAdminTenantsDeleteResponse?> mobileDeleteAdminTenant(AdminTenantIdRequest adminTenantIdRequest,) async {
    final response = await mobileDeleteAdminTenantWithHttpInfo(adminTenantIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminTenantsDeleteResponse',) as PostAdminTenantsDeleteResponse;
    
    }
    return null;
  }

  /// Eliminar un usuario
  ///
  /// Elimina permanentemente un usuario de la plataforma. Bloquea la operación si es un gestor de ventas con registros asociados, si es la propia cuenta o si es el último administrador activo.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<Response> mobileDeleteAdminUserWithHttpInfo(AdminUserIdRequest adminUserIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/delete';

    // ignore: prefer_final_locals
    Object? postBody = adminUserIdRequest;

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

  /// Eliminar un usuario
  ///
  /// Elimina permanentemente un usuario de la plataforma. Bloquea la operación si es un gestor de ventas con registros asociados, si es la propia cuenta o si es el último administrador activo.
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<PostAdminUsersDeleteResponse?> mobileDeleteAdminUser(AdminUserIdRequest adminUserIdRequest,) async {
    final response = await mobileDeleteAdminUserWithHttpInfo(adminUserIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminUsersDeleteResponse',) as PostAdminUsersDeleteResponse;
    
    }
    return null;
  }

  /// Obtener el registro de actividad de los usuarios
  ///
  /// Devuelve las entradas del registro de actividad ordenadas por fecha descendente, con filtro opcional por usuario. Paridad con la pestaña de actividad del admin web.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] userId:
  ///   Identificador del usuario a filtrar.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de entradas a devolver.
  Future<Response> mobileGetAdminActivityLogsWithHttpInfo({ String? userId, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/activity-logs';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (userId != null) {
      queryParams.addAll(_queryParams('', 'userId', userId));
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

  /// Obtener el registro de actividad de los usuarios
  ///
  /// Devuelve las entradas del registro de actividad ordenadas por fecha descendente, con filtro opcional por usuario. Paridad con la pestaña de actividad del admin web.
  ///
  /// Parameters:
  ///
  /// * [String] userId:
  ///   Identificador del usuario a filtrar.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de entradas a devolver.
  Future<GetAdminActivityLogsResponse?> mobileGetAdminActivityLogs({ String? userId, int? limit, }) async {
    final response = await mobileGetAdminActivityLogsWithHttpInfo( userId: userId, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAdminActivityLogsResponse',) as GetAdminActivityLogsResponse;
    
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

  /// Listar las sesiones registradas
  ///
  /// Lista las sesiones registradas en la plataforma ordenadas por fecha descendente, con los datos del usuario. Paridad con la pestaña de sesiones del admin web.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAdminSessionsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/admin/sessions';

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

  /// Listar las sesiones registradas
  ///
  /// Lista las sesiones registradas en la plataforma ordenadas por fecha descendente, con los datos del usuario. Paridad con la pestaña de sesiones del admin web.
  Future<GetAdminSessionsResponse?> mobileGetAdminSessions() async {
    final response = await mobileGetAdminSessionsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAdminSessionsResponse',) as GetAdminSessionsResponse;
    
    }
    return null;
  }

  /// Obtener el detalle de una empresa
  ///
  /// Devuelve la ficha completa de una empresa sin descargar la lista entera: datos fiscales, licencia vigente, miembros activos y conteos de usuarios, productos, almacenes y clientes.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] tenantId (required):
  ///   Identificador de la empresa.
  Future<Response> mobileGetAdminTenantDetailWithHttpInfo(String tenantId,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/detail';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

      queryParams.addAll(_queryParams('', 'tenantId', tenantId));

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

  /// Obtener el detalle de una empresa
  ///
  /// Devuelve la ficha completa de una empresa sin descargar la lista entera: datos fiscales, licencia vigente, miembros activos y conteos de usuarios, productos, almacenes y clientes.
  ///
  /// Parameters:
  ///
  /// * [String] tenantId (required):
  ///   Identificador de la empresa.
  Future<GetAdminTenantDetailResponse?> mobileGetAdminTenantDetail(String tenantId,) async {
    final response = await mobileGetAdminTenantDetailWithHttpInfo(tenantId,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAdminTenantDetailResponse',) as GetAdminTenantDetailResponse;
    
    }
    return null;
  }

  /// Ver las licencias de una empresa
  ///
  /// Devuelve el historial de licencias de una empresa ordenado por creación junto con la licencia vigente, si existe.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] tenantId (required):
  ///   Identificador de la empresa.
  Future<Response> mobileGetAdminTenantLicenseWithHttpInfo(String tenantId,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/license';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

      queryParams.addAll(_queryParams('', 'tenantId', tenantId));

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

  /// Ver las licencias de una empresa
  ///
  /// Devuelve el historial de licencias de una empresa ordenado por creación junto con la licencia vigente, si existe.
  ///
  /// Parameters:
  ///
  /// * [String] tenantId (required):
  ///   Identificador de la empresa.
  Future<GetAdminTenantLicenseResponse?> mobileGetAdminTenantLicense(String tenantId,) async {
    final response = await mobileGetAdminTenantLicenseWithHttpInfo(tenantId,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAdminTenantLicenseResponse',) as GetAdminTenantLicenseResponse;
    
    }
    return null;
  }

  /// Listar los usuarios de una empresa
  ///
  /// Lista los usuarios pertenecientes a una empresa con su rol operativo y el estado de su membresía, sin descargar el listado global.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] tenantId (required):
  ///   Identificador de la empresa.
  Future<Response> mobileGetAdminTenantUsersWithHttpInfo(String tenantId,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/users';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

      queryParams.addAll(_queryParams('', 'tenantId', tenantId));

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

  /// Listar los usuarios de una empresa
  ///
  /// Lista los usuarios pertenecientes a una empresa con su rol operativo y el estado de su membresía, sin descargar el listado global.
  ///
  /// Parameters:
  ///
  /// * [String] tenantId (required):
  ///   Identificador de la empresa.
  Future<GetAdminTenantUsersResponse?> mobileGetAdminTenantUsers(String tenantId,) async {
    final response = await mobileGetAdminTenantUsersWithHttpInfo(tenantId,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAdminTenantUsersResponse',) as GetAdminTenantUsersResponse;
    
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

  /// Obtener el detalle de un usuario
  ///
  /// Devuelve la ficha completa de un usuario de la plataforma sin descargar la lista entera: datos personales, estado, verificación de email, membresías por empresa y conteo de sesiones activas.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] userId (required):
  ///   Identificador del usuario a consultar.
  Future<Response> mobileGetAdminUserDetailWithHttpInfo(String userId,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/detail';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

      queryParams.addAll(_queryParams('', 'userId', userId));

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

  /// Obtener el detalle de un usuario
  ///
  /// Devuelve la ficha completa de un usuario de la plataforma sin descargar la lista entera: datos personales, estado, verificación de email, membresías por empresa y conteo de sesiones activas.
  ///
  /// Parameters:
  ///
  /// * [String] userId (required):
  ///   Identificador del usuario a consultar.
  Future<GetAdminUserDetailResponse?> mobileGetAdminUserDetail(String userId,) async {
    final response = await mobileGetAdminUserDetailWithHttpInfo(userId,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAdminUserDetailResponse',) as GetAdminUserDetailResponse;
    
    }
    return null;
  }

  /// Obtener el historial de sesiones de un usuario
  ///
  /// Devuelve el historial de inicios de sesión de un usuario ordenado por fecha descendente. Paridad con el diálogo de historial del admin web.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] userId (required):
  ///   Identificador del usuario.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de entradas a devolver.
  Future<Response> mobileGetAdminUserLoginHistoryWithHttpInfo(String userId, { int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/login-history';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

      queryParams.addAll(_queryParams('', 'userId', userId));
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

  /// Obtener el historial de sesiones de un usuario
  ///
  /// Devuelve el historial de inicios de sesión de un usuario ordenado por fecha descendente. Paridad con el diálogo de historial del admin web.
  ///
  /// Parameters:
  ///
  /// * [String] userId (required):
  ///   Identificador del usuario.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de entradas a devolver.
  Future<GetAdminUserLoginHistoryResponse?> mobileGetAdminUserLoginHistory(String userId, { int? limit, }) async {
    final response = await mobileGetAdminUserLoginHistoryWithHttpInfo(userId,  limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAdminUserLoginHistoryResponse',) as GetAdminUserLoginHistoryResponse;
    
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

  /// Quitar un usuario de una empresa
  ///
  /// Quita un usuario de una empresa desactivando su membresía, sin eliminar su cuenta de la plataforma. Es reversible reasignándolo.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminRemoveTenantUserRequest] adminRemoveTenantUserRequest (required):
  Future<Response> mobileRemoveAdminTenantUserWithHttpInfo(AdminRemoveTenantUserRequest adminRemoveTenantUserRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/remove-user';

    // ignore: prefer_final_locals
    Object? postBody = adminRemoveTenantUserRequest;

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

  /// Quitar un usuario de una empresa
  ///
  /// Quita un usuario de una empresa desactivando su membresía, sin eliminar su cuenta de la plataforma. Es reversible reasignándolo.
  ///
  /// Parameters:
  ///
  /// * [AdminRemoveTenantUserRequest] adminRemoveTenantUserRequest (required):
  Future<PostAdminTenantsRemoveUserResponse?> mobileRemoveAdminTenantUser(AdminRemoveTenantUserRequest adminRemoveTenantUserRequest,) async {
    final response = await mobileRemoveAdminTenantUserWithHttpInfo(adminRemoveTenantUserRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminTenantsRemoveUserResponse',) as PostAdminTenantsRemoveUserResponse;
    
    }
    return null;
  }

  /// Renovar una licencia
  ///
  /// Renueva una licencia extendiendo su expiración según la duración del plan indicado (o el actual), sincronizando límites y reactivando a los usuarios de la empresa. No registra pagos; el registro de pagos se hace desde la web.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [RenewAdminLicenseRequest] renewAdminLicenseRequest (required):
  Future<Response> mobileRenewAdminLicenseWithHttpInfo(RenewAdminLicenseRequest renewAdminLicenseRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/licenses/renew';

    // ignore: prefer_final_locals
    Object? postBody = renewAdminLicenseRequest;

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

  /// Renovar una licencia
  ///
  /// Renueva una licencia extendiendo su expiración según la duración del plan indicado (o el actual), sincronizando límites y reactivando a los usuarios de la empresa. No registra pagos; el registro de pagos se hace desde la web.
  ///
  /// Parameters:
  ///
  /// * [RenewAdminLicenseRequest] renewAdminLicenseRequest (required):
  Future<PostAdminLicensesRenewResponse?> mobileRenewAdminLicense(RenewAdminLicenseRequest renewAdminLicenseRequest,) async {
    final response = await mobileRenewAdminLicenseWithHttpInfo(renewAdminLicenseRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminLicensesRenewResponse',) as PostAdminLicensesRenewResponse;
    
    }
    return null;
  }

  /// Reenviar el email de verificación
  ///
  /// Genera un nuevo enlace de verificación y lo reenvía al correo del usuario. Falla si el correo ya fue verificado previamente.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<Response> mobileResendAdminUserVerificationWithHttpInfo(AdminUserIdRequest adminUserIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/resend-verification';

    // ignore: prefer_final_locals
    Object? postBody = adminUserIdRequest;

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

  /// Reenviar el email de verificación
  ///
  /// Genera un nuevo enlace de verificación y lo reenvía al correo del usuario. Falla si el correo ya fue verificado previamente.
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<PostAdminUsersResendVerificationResponse?> mobileResendAdminUserVerification(AdminUserIdRequest adminUserIdRequest,) async {
    final response = await mobileResendAdminUserVerificationWithHttpInfo(adminUserIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminUsersResendVerificationResponse',) as PostAdminUsersResendVerificationResponse;
    
    }
    return null;
  }

  /// Enviar enlace de restablecimiento de contraseña
  ///
  /// Genera un enlace temporal de restablecimiento de contraseña y lo envía al correo del usuario. El administrador nunca ve ni define la contraseña del usuario.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<Response> mobileResetAdminUserPasswordWithHttpInfo(AdminUserIdRequest adminUserIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/reset-password';

    // ignore: prefer_final_locals
    Object? postBody = adminUserIdRequest;

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

  /// Enviar enlace de restablecimiento de contraseña
  ///
  /// Genera un enlace temporal de restablecimiento de contraseña y lo envía al correo del usuario. El administrador nunca ve ni define la contraseña del usuario.
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<PostAdminUsersResetPasswordResponse?> mobileResetAdminUserPassword(AdminUserIdRequest adminUserIdRequest,) async {
    final response = await mobileResetAdminUserPasswordWithHttpInfo(adminUserIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminUsersResetPasswordResponse',) as PostAdminUsersResetPasswordResponse;
    
    }
    return null;
  }

  /// Revocar una sesión específica
  ///
  /// Revoca una sesión puntual de un usuario, cerrando su acceso en ese dispositivo. A diferencia de la acción web equivalente, elimina por el identificador real de la sesión.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminRevokeSessionRequest] adminRevokeSessionRequest (required):
  Future<Response> mobileRevokeAdminSessionWithHttpInfo(AdminRevokeSessionRequest adminRevokeSessionRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/sessions/revoke';

    // ignore: prefer_final_locals
    Object? postBody = adminRevokeSessionRequest;

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

  /// Revocar una sesión específica
  ///
  /// Revoca una sesión puntual de un usuario, cerrando su acceso en ese dispositivo. A diferencia de la acción web equivalente, elimina por el identificador real de la sesión.
  ///
  /// Parameters:
  ///
  /// * [AdminRevokeSessionRequest] adminRevokeSessionRequest (required):
  Future<PostAdminSessionsRevokeResponse?> mobileRevokeAdminSession(AdminRevokeSessionRequest adminRevokeSessionRequest,) async {
    final response = await mobileRevokeAdminSessionWithHttpInfo(adminRevokeSessionRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminSessionsRevokeResponse',) as PostAdminSessionsRevokeResponse;
    
    }
    return null;
  }

  /// Revocar las sesiones activas de un usuario
  ///
  /// Invalida todas las sesiones activas del usuario, forzando un nuevo inicio de sesión en cada dispositivo donde estuviera conectado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<Response> mobileRevokeAdminUserSessionsWithHttpInfo(AdminUserIdRequest adminUserIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/revoke-sessions';

    // ignore: prefer_final_locals
    Object? postBody = adminUserIdRequest;

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

  /// Revocar las sesiones activas de un usuario
  ///
  /// Invalida todas las sesiones activas del usuario, forzando un nuevo inicio de sesión en cada dispositivo donde estuviera conectado.
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<PostAdminUsersRevokeSessionsResponse?> mobileRevokeAdminUserSessions(AdminUserIdRequest adminUserIdRequest,) async {
    final response = await mobileRevokeAdminUserSessionsWithHttpInfo(adminUserIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminUsersRevokeSessionsResponse',) as PostAdminUsersRevokeSessionsResponse;
    
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

  /// Editar los datos de una empresa
  ///
  /// Actualiza el nombre, los datos fiscales y la configuración de una empresa. Valida que el identificador público no esté en uso por otra empresa.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [UpdateAdminTenantRequest] updateAdminTenantRequest (required):
  Future<Response> mobileUpdateAdminTenantWithHttpInfo(UpdateAdminTenantRequest updateAdminTenantRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/update';

    // ignore: prefer_final_locals
    Object? postBody = updateAdminTenantRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'PATCH',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Editar los datos de una empresa
  ///
  /// Actualiza el nombre, los datos fiscales y la configuración de una empresa. Valida que el identificador público no esté en uso por otra empresa.
  ///
  /// Parameters:
  ///
  /// * [UpdateAdminTenantRequest] updateAdminTenantRequest (required):
  Future<PatchAdminTenantsUpdateResponse?> mobileUpdateAdminTenant(UpdateAdminTenantRequest updateAdminTenantRequest,) async {
    final response = await mobileUpdateAdminTenantWithHttpInfo(updateAdminTenantRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PatchAdminTenantsUpdateResponse',) as PatchAdminTenantsUpdateResponse;
    
    }
    return null;
  }

  /// Actualizar la licencia de una empresa
  ///
  /// Cambia el plan, los límites o el vencimiento de una licencia. Al cambiar de plan se sincronizan límites y precios del plan, salvo los límites indicados explícitamente.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [UpdateAdminTenantLicenseRequest] updateAdminTenantLicenseRequest (required):
  Future<Response> mobileUpdateAdminTenantLicenseWithHttpInfo(UpdateAdminTenantLicenseRequest updateAdminTenantLicenseRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/tenants/license/update';

    // ignore: prefer_final_locals
    Object? postBody = updateAdminTenantLicenseRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'PATCH',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Actualizar la licencia de una empresa
  ///
  /// Cambia el plan, los límites o el vencimiento de una licencia. Al cambiar de plan se sincronizan límites y precios del plan, salvo los límites indicados explícitamente.
  ///
  /// Parameters:
  ///
  /// * [UpdateAdminTenantLicenseRequest] updateAdminTenantLicenseRequest (required):
  Future<PatchAdminTenantsLicenseUpdateResponse?> mobileUpdateAdminTenantLicense(UpdateAdminTenantLicenseRequest updateAdminTenantLicenseRequest,) async {
    final response = await mobileUpdateAdminTenantLicenseWithHttpInfo(updateAdminTenantLicenseRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PatchAdminTenantsLicenseUpdateResponse',) as PatchAdminTenantsLicenseUpdateResponse;
    
    }
    return null;
  }

  /// Editar nombre, email o rol de un usuario
  ///
  /// Actualiza los datos básicos de un usuario: nombre, correo electrónico o rol de plataforma. Valida que el correo no esté en uso por otro usuario y protege al último administrador activo.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [UpdateAdminUserRequest] updateAdminUserRequest (required):
  Future<Response> mobileUpdateAdminUserWithHttpInfo(UpdateAdminUserRequest updateAdminUserRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/update';

    // ignore: prefer_final_locals
    Object? postBody = updateAdminUserRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'PATCH',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Editar nombre, email o rol de un usuario
  ///
  /// Actualiza los datos básicos de un usuario: nombre, correo electrónico o rol de plataforma. Valida que el correo no esté en uso por otro usuario y protege al último administrador activo.
  ///
  /// Parameters:
  ///
  /// * [UpdateAdminUserRequest] updateAdminUserRequest (required):
  Future<PatchAdminUsersUpdateResponse?> mobileUpdateAdminUser(UpdateAdminUserRequest updateAdminUserRequest,) async {
    final response = await mobileUpdateAdminUserWithHttpInfo(updateAdminUserRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PatchAdminUsersUpdateResponse',) as PatchAdminUsersUpdateResponse;
    
    }
    return null;
  }

  /// Marcar el email como verificado
  ///
  /// Marca manualmente el correo de un usuario como verificado, sin necesidad de que complete el flujo de verificación por email. Es idempotente si ya estaba verificado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<Response> mobileVerifyAdminUserEmailWithHttpInfo(AdminUserIdRequest adminUserIdRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/admin/users/verify-email';

    // ignore: prefer_final_locals
    Object? postBody = adminUserIdRequest;

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

  /// Marcar el email como verificado
  ///
  /// Marca manualmente el correo de un usuario como verificado, sin necesidad de que complete el flujo de verificación por email. Es idempotente si ya estaba verificado.
  ///
  /// Parameters:
  ///
  /// * [AdminUserIdRequest] adminUserIdRequest (required):
  Future<PostAdminUsersVerifyEmailResponse?> mobileVerifyAdminUserEmail(AdminUserIdRequest adminUserIdRequest,) async {
    final response = await mobileVerifyAdminUserEmailWithHttpInfo(adminUserIdRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAdminUsersVerifyEmailResponse',) as PostAdminUsersVerifyEmailResponse;
    
    }
    return null;
  }
}
