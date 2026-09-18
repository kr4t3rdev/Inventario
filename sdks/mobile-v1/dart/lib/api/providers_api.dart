//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class ProvidersApi {
  ProvidersApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Eliminar proveedor
  ///
  /// Elimina un proveedor del tenant activo y devuelve la confirmación.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del proveedor.
  Future<Response> mobileDeleteProvidersByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/providers/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'DELETE',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Eliminar proveedor
  ///
  /// Elimina un proveedor del tenant activo y devuelve la confirmación.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del proveedor.
  Future<ProveedorDeleteResponse?> mobileDeleteProvidersById(String id,) async {
    final response = await mobileDeleteProvidersByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'ProveedorDeleteResponse',) as ProveedorDeleteResponse;
    
    }
    return null;
  }

  /// Listar proveedores
  ///
  /// Devuelve los proveedores del tenant activo ordenados por creación descendente.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetProvidersWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/providers';

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

  /// Listar proveedores
  ///
  /// Devuelve los proveedores del tenant activo ordenados por creación descendente.
  Future<ProveedorListResponse?> mobileGetProviders() async {
    final response = await mobileGetProvidersWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'ProveedorListResponse',) as ProveedorListResponse;
    
    }
    return null;
  }

  /// Consultar proveedor
  ///
  /// Devuelve el detalle de un proveedor del tenant activo.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del proveedor.
  Future<Response> mobileGetProvidersByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/providers/{id}'
      .replaceAll('{id}', id);

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

  /// Consultar proveedor
  ///
  /// Devuelve el detalle de un proveedor del tenant activo.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del proveedor.
  Future<Proveedor?> mobileGetProvidersById(String id,) async {
    final response = await mobileGetProvidersByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'Proveedor',) as Proveedor;
    
    }
    return null;
  }

  /// Crear proveedor
  ///
  /// Crea un proveedor en el tenant activo y devuelve el registro creado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [ProveedorCreateRequest] proveedorCreateRequest (required):
  Future<Response> mobilePostProvidersCreateWithHttpInfo(ProveedorCreateRequest proveedorCreateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/providers/create';

    // ignore: prefer_final_locals
    Object? postBody = proveedorCreateRequest;

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

  /// Crear proveedor
  ///
  /// Crea un proveedor en el tenant activo y devuelve el registro creado.
  ///
  /// Parameters:
  ///
  /// * [ProveedorCreateRequest] proveedorCreateRequest (required):
  Future<Proveedor?> mobilePostProvidersCreate(ProveedorCreateRequest proveedorCreateRequest,) async {
    final response = await mobilePostProvidersCreateWithHttpInfo(proveedorCreateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'Proveedor',) as Proveedor;
    
    }
    return null;
  }

  /// Editar proveedor
  ///
  /// Actualiza los datos de un proveedor del tenant activo y devuelve el registro actualizado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del proveedor.
  ///
  /// * [ProveedorUpdateRequest] proveedorUpdateRequest (required):
  Future<Response> mobilePutProvidersByIdWithHttpInfo(String id, ProveedorUpdateRequest proveedorUpdateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/providers/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = proveedorUpdateRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'PUT',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Editar proveedor
  ///
  /// Actualiza los datos de un proveedor del tenant activo y devuelve el registro actualizado.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del proveedor.
  ///
  /// * [ProveedorUpdateRequest] proveedorUpdateRequest (required):
  Future<Proveedor?> mobilePutProvidersById(String id, ProveedorUpdateRequest proveedorUpdateRequest,) async {
    final response = await mobilePutProvidersByIdWithHttpInfo(id, proveedorUpdateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'Proveedor',) as Proveedor;
    
    }
    return null;
  }
}
