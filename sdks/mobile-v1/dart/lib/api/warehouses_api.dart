//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class WarehousesApi {
  WarehousesApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Eliminar almacén
  ///
  /// Elimina un almacén del tenant activo y devuelve la confirmación.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del almacén.
  Future<Response> mobileDeleteWarehousesByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/warehouses/{id}'
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

  /// Eliminar almacén
  ///
  /// Elimina un almacén del tenant activo y devuelve la confirmación.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del almacén.
  Future<AlmacenDeleteResponse?> mobileDeleteWarehousesById(String id,) async {
    final response = await mobileDeleteWarehousesByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'AlmacenDeleteResponse',) as AlmacenDeleteResponse;
    
    }
    return null;
  }

  /// Listar almacenes
  ///
  /// Devuelve los almacenes del tenant activo ordenados por nombre ascendente.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetWarehousesWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/warehouses';

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

  /// Listar almacenes
  ///
  /// Devuelve los almacenes del tenant activo ordenados por nombre ascendente.
  Future<AlmacenListResponse?> mobileGetWarehouses() async {
    final response = await mobileGetWarehousesWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'AlmacenListResponse',) as AlmacenListResponse;
    
    }
    return null;
  }

  /// Consultar almacén
  ///
  /// Devuelve el detalle de un almacén del tenant activo.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del almacén.
  Future<Response> mobileGetWarehousesByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/warehouses/{id}'
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

  /// Consultar almacén
  ///
  /// Devuelve el detalle de un almacén del tenant activo.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del almacén.
  Future<Almacen?> mobileGetWarehousesById(String id,) async {
    final response = await mobileGetWarehousesByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'Almacen',) as Almacen;
    
    }
    return null;
  }

  /// Crear almacén
  ///
  /// Crea un almacén en el tenant activo y devuelve el registro creado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AlmacenCreateRequest] almacenCreateRequest (required):
  Future<Response> mobilePostWarehousesCreateWithHttpInfo(AlmacenCreateRequest almacenCreateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/warehouses/create';

    // ignore: prefer_final_locals
    Object? postBody = almacenCreateRequest;

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

  /// Crear almacén
  ///
  /// Crea un almacén en el tenant activo y devuelve el registro creado.
  ///
  /// Parameters:
  ///
  /// * [AlmacenCreateRequest] almacenCreateRequest (required):
  Future<Almacen?> mobilePostWarehousesCreate(AlmacenCreateRequest almacenCreateRequest,) async {
    final response = await mobilePostWarehousesCreateWithHttpInfo(almacenCreateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'Almacen',) as Almacen;
    
    }
    return null;
  }

  /// Editar almacén
  ///
  /// Actualiza los datos de un almacén del tenant activo y devuelve el registro actualizado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del almacén.
  ///
  /// * [AlmacenUpdateRequest] almacenUpdateRequest (required):
  Future<Response> mobilePutWarehousesByIdWithHttpInfo(String id, AlmacenUpdateRequest almacenUpdateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/warehouses/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = almacenUpdateRequest;

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

  /// Editar almacén
  ///
  /// Actualiza los datos de un almacén del tenant activo y devuelve el registro actualizado.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del almacén.
  ///
  /// * [AlmacenUpdateRequest] almacenUpdateRequest (required):
  Future<Almacen?> mobilePutWarehousesById(String id, AlmacenUpdateRequest almacenUpdateRequest,) async {
    final response = await mobilePutWarehousesByIdWithHttpInfo(id, almacenUpdateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'Almacen',) as Almacen;
    
    }
    return null;
  }
}
