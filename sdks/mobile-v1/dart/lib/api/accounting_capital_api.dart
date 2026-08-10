//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class AccountingCapitalApi {
  AccountingCapitalApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar inyecciones de capital
  ///
  /// Lista aportes de capital registrados para el tenant. Permite precisar la consulta mediante tipo.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  Future<Response> mobileGetAccountingCapitalInjectionsWithHttpInfo({ String? tipo, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/capital-injections';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (tipo != null) {
      queryParams.addAll(_queryParams('', 'tipo', tipo));
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

  /// Consultar inyecciones de capital
  ///
  /// Lista aportes de capital registrados para el tenant. Permite precisar la consulta mediante tipo.
  ///
  /// Parameters:
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  Future<GetAccountingCapitalInjectionsResponse?> mobileGetAccountingCapitalInjections({ String? tipo, }) async {
    final response = await mobileGetAccountingCapitalInjectionsWithHttpInfo( tipo: tipo, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingCapitalInjectionsResponse',) as GetAccountingCapitalInjectionsResponse;
    
    }
    return null;
  }

  /// Registrar inyecciones de capital
  ///
  /// Registra un aporte de capital y lo vincula con la cuenta bancaria indicada cuando corresponde.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [CapitalInjectionCreateRequest] capitalInjectionCreateRequest (required):
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  Future<Response> mobilePostAccountingCapitalInjectionsWithHttpInfo(CapitalInjectionCreateRequest capitalInjectionCreateRequest, { String? tipo, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/capital-injections';

    // ignore: prefer_final_locals
    Object? postBody = capitalInjectionCreateRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (tipo != null) {
      queryParams.addAll(_queryParams('', 'tipo', tipo));
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

  /// Registrar inyecciones de capital
  ///
  /// Registra un aporte de capital y lo vincula con la cuenta bancaria indicada cuando corresponde.
  ///
  /// Parameters:
  ///
  /// * [CapitalInjectionCreateRequest] capitalInjectionCreateRequest (required):
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  Future<PostAccountingCapitalInjectionsResponse?> mobilePostAccountingCapitalInjections(CapitalInjectionCreateRequest capitalInjectionCreateRequest, { String? tipo, }) async {
    final response = await mobilePostAccountingCapitalInjectionsWithHttpInfo(capitalInjectionCreateRequest,  tipo: tipo, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingCapitalInjectionsResponse',) as PostAccountingCapitalInjectionsResponse;
    
    }
    return null;
  }

  /// Registrar pago de inyecciones de capital
  ///
  /// Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [CapitalPaymentRequest] capitalPaymentRequest (required):
  Future<Response> mobilePostAccountingCapitalInjectionsByIdPaymentsWithHttpInfo(String id, CapitalPaymentRequest capitalPaymentRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/capital-injections/{id}/payments'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = capitalPaymentRequest;

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

  /// Registrar pago de inyecciones de capital
  ///
  /// Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [CapitalPaymentRequest] capitalPaymentRequest (required):
  Future<PostAccountingCapitalInjectionsIdPaymentsResponse?> mobilePostAccountingCapitalInjectionsByIdPayments(String id, CapitalPaymentRequest capitalPaymentRequest,) async {
    final response = await mobilePostAccountingCapitalInjectionsByIdPaymentsWithHttpInfo(id, capitalPaymentRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingCapitalInjectionsIdPaymentsResponse',) as PostAccountingCapitalInjectionsIdPaymentsResponse;
    
    }
    return null;
  }
}
