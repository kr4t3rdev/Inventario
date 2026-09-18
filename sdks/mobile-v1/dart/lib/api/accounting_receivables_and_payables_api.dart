//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class AccountingReceivablesAndPayablesApi {
  AccountingReceivablesAndPayablesApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar cuentas por pagar
  ///
  /// Lista obligaciones con proveedores y muestra saldos, estado y métricas de pago. Permite precisar la consulta mediante texto de búsqueda, estado, tipo, página, límite por página.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] search:
  ///   Texto de búsqueda aplicado por el servicio.
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingAccountsPayableWithHttpInfo({ String? search, bool? estado, String? tipo, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/accounts-payable';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (search != null) {
      queryParams.addAll(_queryParams('', 'search', search));
    }
    if (estado != null) {
      queryParams.addAll(_queryParams('', 'estado', estado));
    }
    if (tipo != null) {
      queryParams.addAll(_queryParams('', 'tipo', tipo));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
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

  /// Consultar cuentas por pagar
  ///
  /// Lista obligaciones con proveedores y muestra saldos, estado y métricas de pago. Permite precisar la consulta mediante texto de búsqueda, estado, tipo, página, límite por página.
  ///
  /// Parameters:
  ///
  /// * [String] search:
  ///   Texto de búsqueda aplicado por el servicio.
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingAccountsPayableResponse?> mobileGetAccountingAccountsPayable({ String? search, bool? estado, String? tipo, int? page, int? limit, }) async {
    final response = await mobileGetAccountingAccountsPayableWithHttpInfo( search: search, estado: estado, tipo: tipo, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingAccountsPayableResponse',) as GetAccountingAccountsPayableResponse;
    
    }
    return null;
  }

  /// Consultar cuentas por cobrar
  ///
  /// Lista obligaciones de clientes y sus saldos pendientes dentro del tenant. Permite precisar la consulta mediante texto de búsqueda, estado, cliente, página, límite por página.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] search:
  ///   Texto de búsqueda aplicado por el servicio.
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingAccountsReceivableWithHttpInfo({ String? search, bool? estado, String? clienteId, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/accounts-receivable';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (search != null) {
      queryParams.addAll(_queryParams('', 'search', search));
    }
    if (estado != null) {
      queryParams.addAll(_queryParams('', 'estado', estado));
    }
    if (clienteId != null) {
      queryParams.addAll(_queryParams('', 'clienteId', clienteId));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
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

  /// Consultar cuentas por cobrar
  ///
  /// Lista obligaciones de clientes y sus saldos pendientes dentro del tenant. Permite precisar la consulta mediante texto de búsqueda, estado, cliente, página, límite por página.
  ///
  /// Parameters:
  ///
  /// * [String] search:
  ///   Texto de búsqueda aplicado por el servicio.
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingAccountsReceivableResponse?> mobileGetAccountingAccountsReceivable({ String? search, bool? estado, String? clienteId, int? page, int? limit, }) async {
    final response = await mobileGetAccountingAccountsReceivableWithHttpInfo( search: search, estado: estado, clienteId: clienteId, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingAccountsReceivableResponse',) as GetAccountingAccountsReceivableResponse;
    
    }
    return null;
  }

  /// Consultar métricas de cuentas por cobrar
  ///
  /// Calcula los importes agregados y estados de las cuentas por cobrar.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAccountingAccountsReceivableMetricsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/accounts-receivable/metrics';

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

  /// Consultar métricas de cuentas por cobrar
  ///
  /// Calcula los importes agregados y estados de las cuentas por cobrar.
  Future<GetAccountingAccountsReceivableMetricsResponse?> mobileGetAccountingAccountsReceivableMetrics() async {
    final response = await mobileGetAccountingAccountsReceivableMetricsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingAccountsReceivableMetricsResponse',) as GetAccountingAccountsReceivableMetricsResponse;
    
    }
    return null;
  }
}
