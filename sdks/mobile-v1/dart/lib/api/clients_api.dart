//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class ClientsApi {
  ClientsApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Eliminar cliente
  ///
  /// Elimina un cliente del tenant activo y devuelve la confirmación.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del cliente.
  Future<Response> mobileDeleteClientsByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/clients/{id}'
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

  /// Eliminar cliente
  ///
  /// Elimina un cliente del tenant activo y devuelve la confirmación.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del cliente.
  Future<ClienteDeleteResponse?> mobileDeleteClientsById(String id,) async {
    final response = await mobileDeleteClientsByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'ClienteDeleteResponse',) as ClienteDeleteResponse;
    
    }
    return null;
  }

  /// Listar clientes
  ///
  /// Devuelve los clientes del tenant activo ordenados por creación descendente.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetClientsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/clients';

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

  /// Listar clientes
  ///
  /// Devuelve los clientes del tenant activo ordenados por creación descendente.
  Future<ClienteListResponse?> mobileGetClients() async {
    final response = await mobileGetClientsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'ClienteListResponse',) as ClienteListResponse;
    
    }
    return null;
  }

  /// Consultar cliente
  ///
  /// Devuelve el detalle de un cliente del tenant activo.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del cliente.
  Future<Response> mobileGetClientsByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/clients/{id}'
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

  /// Consultar cliente
  ///
  /// Devuelve el detalle de un cliente del tenant activo.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del cliente.
  Future<Cliente?> mobileGetClientsById(String id,) async {
    final response = await mobileGetClientsByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'Cliente',) as Cliente;
    
    }
    return null;
  }

  /// Crear cliente
  ///
  /// Crea un cliente en el tenant activo y devuelve el registro creado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [ClienteCreateRequest] clienteCreateRequest (required):
  Future<Response> mobilePostClientsCreateWithHttpInfo(ClienteCreateRequest clienteCreateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/clients/create';

    // ignore: prefer_final_locals
    Object? postBody = clienteCreateRequest;

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

  /// Crear cliente
  ///
  /// Crea un cliente en el tenant activo y devuelve el registro creado.
  ///
  /// Parameters:
  ///
  /// * [ClienteCreateRequest] clienteCreateRequest (required):
  Future<Cliente?> mobilePostClientsCreate(ClienteCreateRequest clienteCreateRequest,) async {
    final response = await mobilePostClientsCreateWithHttpInfo(clienteCreateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'Cliente',) as Cliente;
    
    }
    return null;
  }

  /// Editar cliente
  ///
  /// Actualiza los datos de un cliente del tenant activo y devuelve el registro actualizado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del cliente.
  ///
  /// * [ClienteUpdateRequest] clienteUpdateRequest (required):
  Future<Response> mobilePutClientsByIdWithHttpInfo(String id, ClienteUpdateRequest clienteUpdateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/clients/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = clienteUpdateRequest;

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

  /// Editar cliente
  ///
  /// Actualiza los datos de un cliente del tenant activo y devuelve el registro actualizado.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador del cliente.
  ///
  /// * [ClienteUpdateRequest] clienteUpdateRequest (required):
  Future<Cliente?> mobilePutClientsById(String id, ClienteUpdateRequest clienteUpdateRequest,) async {
    final response = await mobilePutClientsByIdWithHttpInfo(id, clienteUpdateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'Cliente',) as Cliente;
    
    }
    return null;
  }
}
