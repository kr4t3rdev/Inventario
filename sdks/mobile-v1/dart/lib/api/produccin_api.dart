//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class ProduccinApi {
  ProduccinApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Detalle de orden de producción
  ///
  /// Devuelve el detalle de una orden de producción.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  Future<Response> mobileGetProduccionByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/produccion/{id}'
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

  /// Detalle de orden de producción
  ///
  /// Devuelve el detalle de una orden de producción.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  Future<GetProduccionDetailResponse?> mobileGetProduccionById(String id,) async {
    final response = await mobileGetProduccionByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetProduccionDetailResponse',) as GetProduccionDetailResponse;
    
    }
    return null;
  }

  /// Listar órdenes de producción
  ///
  /// Devuelve el listado de órdenes de producción del tenant.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileListProduccionWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/produccion';

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

  /// Listar órdenes de producción
  ///
  /// Devuelve el listado de órdenes de producción del tenant.
  Future<GetProduccionListResponse?> mobileListProduccion() async {
    final response = await mobileListProduccionWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetProduccionListResponse',) as GetProduccionListResponse;
    
    }
    return null;
  }
}
