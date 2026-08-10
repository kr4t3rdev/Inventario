//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class AuthApi {
  AuthApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar perfil autenticado
  ///
  /// Devuelve la identidad, rol y contexto de tenant contenidos en la sesión Bearer vigente.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAuthMeWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/auth/me';

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

  /// Consultar perfil autenticado
  ///
  /// Devuelve la identidad, rol y contexto de tenant contenidos en la sesión Bearer vigente.
  Future<AuthenticatedUser?> mobileGetAuthMe() async {
    final response = await mobileGetAuthMeWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'AuthenticatedUser',) as AuthenticatedUser;
    
    }
    return null;
  }

  /// Listar tenants accesibles
  ///
  /// Devuelve los tenants activos a los que pertenece el usuario autenticado.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAuthTenantsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/auth/tenants';

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

  /// Listar tenants accesibles
  ///
  /// Devuelve los tenants activos a los que pertenece el usuario autenticado.
  Future<TenantListResponse?> mobileGetAuthTenants() async {
    final response = await mobileGetAuthTenantsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'TenantListResponse',) as TenantListResponse;
    
    }
    return null;
  }

  /// Iniciar sesión móvil
  ///
  /// Valida las credenciales y entrega el usuario autenticado junto con los tokens de acceso y renovación.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [LoginRequest] loginRequest (required):
  ///
  /// * [String] xTenantId:
  ///   Tenant que se desea activar al iniciar sesión; si se omite, el servicio resuelve el contexto disponible.
  Future<Response> mobilePostAuthLoginWithHttpInfo(LoginRequest loginRequest, { String? xTenantId, }) async {
    // ignore: prefer_const_declarations
    final path = r'/auth/login';

    // ignore: prefer_final_locals
    Object? postBody = loginRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (xTenantId != null) {
      headerParams[r'x-tenant-id'] = parameterToString(xTenantId);
    }

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

  /// Iniciar sesión móvil
  ///
  /// Valida las credenciales y entrega el usuario autenticado junto con los tokens de acceso y renovación.
  ///
  /// Parameters:
  ///
  /// * [LoginRequest] loginRequest (required):
  ///
  /// * [String] xTenantId:
  ///   Tenant que se desea activar al iniciar sesión; si se omite, el servicio resuelve el contexto disponible.
  Future<AuthSession?> mobilePostAuthLogin(LoginRequest loginRequest, { String? xTenantId, }) async {
    final response = await mobilePostAuthLoginWithHttpInfo(loginRequest,  xTenantId: xTenantId, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'AuthSession',) as AuthSession;
    
    }
    return null;
  }

  /// Cerrar sesión actual
  ///
  /// Invalida la sesión autenticada para impedir el uso posterior de sus credenciales de renovación.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobilePostAuthLogoutWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/auth/logout';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];


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

  /// Cerrar sesión actual
  ///
  /// Invalida la sesión autenticada para impedir el uso posterior de sus credenciales de renovación.
  Future<SuccessResponse?> mobilePostAuthLogout() async {
    final response = await mobilePostAuthLogoutWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'SuccessResponse',) as SuccessResponse;
    
    }
    return null;
  }

  /// Renovar tokens de sesión
  ///
  /// Valida el token de renovación y emite un nuevo par de tokens para continuar la sesión.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [RefreshRequest] refreshRequest (required):
  Future<Response> mobilePostAuthRefreshWithHttpInfo(RefreshRequest refreshRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/auth/refresh';

    // ignore: prefer_final_locals
    Object? postBody = refreshRequest;

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

  /// Renovar tokens de sesión
  ///
  /// Valida el token de renovación y emite un nuevo par de tokens para continuar la sesión.
  ///
  /// Parameters:
  ///
  /// * [RefreshRequest] refreshRequest (required):
  Future<TokenPair?> mobilePostAuthRefresh(RefreshRequest refreshRequest,) async {
    final response = await mobilePostAuthRefreshWithHttpInfo(refreshRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'TokenPair',) as TokenPair;
    
    }
    return null;
  }

  /// Cambiar tenant activo
  ///
  /// Cambia el contexto de tenant y entrega tokens nuevos asociados a la membresía seleccionada.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [SwitchTenantRequest] switchTenantRequest (required):
  Future<Response> mobilePostAuthTenantsWithHttpInfo(SwitchTenantRequest switchTenantRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/auth/tenants';

    // ignore: prefer_final_locals
    Object? postBody = switchTenantRequest;

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

  /// Cambiar tenant activo
  ///
  /// Cambia el contexto de tenant y entrega tokens nuevos asociados a la membresía seleccionada.
  ///
  /// Parameters:
  ///
  /// * [SwitchTenantRequest] switchTenantRequest (required):
  Future<SwitchTenantResponse?> mobilePostAuthTenants(SwitchTenantRequest switchTenantRequest,) async {
    final response = await mobilePostAuthTenantsWithHttpInfo(switchTenantRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'SwitchTenantResponse',) as SwitchTenantResponse;
    
    }
    return null;
  }
}
