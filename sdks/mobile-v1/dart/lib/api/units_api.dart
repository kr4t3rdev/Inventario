//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class UnitsApi {
  UnitsApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Crear unidad
  ///
  /// Crea una nueva unidad de medida.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [MobileCreateUnitRequest] mobileCreateUnitRequest (required):
  Future<Response> mobileCreateUnitWithHttpInfo(MobileCreateUnitRequest mobileCreateUnitRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/units/create';

    // ignore: prefer_final_locals
    Object? postBody = mobileCreateUnitRequest;

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

  /// Crear unidad
  ///
  /// Crea una nueva unidad de medida.
  ///
  /// Parameters:
  ///
  /// * [MobileCreateUnitRequest] mobileCreateUnitRequest (required):
  Future<GetUnitsDetailResponse?> mobileCreateUnit(MobileCreateUnitRequest mobileCreateUnitRequest,) async {
    final response = await mobileCreateUnitWithHttpInfo(mobileCreateUnitRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetUnitsDetailResponse',) as GetUnitsDetailResponse;
    
    }
    return null;
  }

  /// Eliminar unidad
  ///
  /// Elimina una unidad de medida.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  Future<Response> mobileDeleteUnitWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/units/{id}'
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

  /// Eliminar unidad
  ///
  /// Elimina una unidad de medida.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  Future<DeleteUnitResponse?> mobileDeleteUnit(String id,) async {
    final response = await mobileDeleteUnitWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DeleteUnitResponse',) as DeleteUnitResponse;
    
    }
    return null;
  }

  /// Listar unidades
  ///
  /// Devuelve las unidades de medida del tenant.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileListUnitsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/units';

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

  /// Listar unidades
  ///
  /// Devuelve las unidades de medida del tenant.
  Future<GetUnitsListResponse?> mobileListUnits() async {
    final response = await mobileListUnitsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetUnitsListResponse',) as GetUnitsListResponse;
    
    }
    return null;
  }

  /// Actualizar unidad
  ///
  /// Actualiza una unidad de medida.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///
  /// * [MobileUpdateUnitRequest] mobileUpdateUnitRequest (required):
  Future<Response> mobileUpdateUnitWithHttpInfo(String id, MobileUpdateUnitRequest mobileUpdateUnitRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/units/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = mobileUpdateUnitRequest;

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

  /// Actualizar unidad
  ///
  /// Actualiza una unidad de medida.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///
  /// * [MobileUpdateUnitRequest] mobileUpdateUnitRequest (required):
  Future<GetUnitsDetailResponse?> mobileUpdateUnit(String id, MobileUpdateUnitRequest mobileUpdateUnitRequest,) async {
    final response = await mobileUpdateUnitWithHttpInfo(id, mobileUpdateUnitRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetUnitsDetailResponse',) as GetUnitsDetailResponse;
    
    }
    return null;
  }
}
