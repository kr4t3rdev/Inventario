//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class TransferenciasApi {
  TransferenciasApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Detalle de transferencia
  ///
  /// Devuelve el detalle de una transferencia.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  Future<Response> mobileGetTransferenciasByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/transferencias/{id}'
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

  /// Detalle de transferencia
  ///
  /// Devuelve el detalle de una transferencia.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  Future<GetTransferenciasDetailResponse?> mobileGetTransferenciasById(String id,) async {
    final response = await mobileGetTransferenciasByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetTransferenciasDetailResponse',) as GetTransferenciasDetailResponse;
    
    }
    return null;
  }

  /// Listar transferencias
  ///
  /// Devuelve el listado de transferencias del tenant.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileListTransferenciasWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/transferencias';

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

  /// Listar transferencias
  ///
  /// Devuelve el listado de transferencias del tenant.
  Future<GetTransferenciasListResponse?> mobileListTransferencias() async {
    final response = await mobileListTransferenciasWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetTransferenciasListResponse',) as GetTransferenciasListResponse;
    
    }
    return null;
  }
}
