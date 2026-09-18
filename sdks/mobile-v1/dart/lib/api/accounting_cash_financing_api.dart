//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class AccountingCashFinancingApi {
  AccountingCashFinancingApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar deudas de efectivo
  ///
  /// Lista deudas de efectivo con proveedores, sus vencimientos y saldos. Permite precisar la consulta mediante estado, proveedor, moneda, página, límite por página.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] proveedorId:
  ///   Identificador del proveedor.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingCashDebtsWithHttpInfo({ bool? estado, String? proveedorId, String? moneda, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-debts';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (estado != null) {
      queryParams.addAll(_queryParams('', 'estado', estado));
    }
    if (proveedorId != null) {
      queryParams.addAll(_queryParams('', 'proveedorId', proveedorId));
    }
    if (moneda != null) {
      queryParams.addAll(_queryParams('', 'moneda', moneda));
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

  /// Consultar deudas de efectivo
  ///
  /// Lista deudas de efectivo con proveedores, sus vencimientos y saldos. Permite precisar la consulta mediante estado, proveedor, moneda, página, límite por página.
  ///
  /// Parameters:
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] proveedorId:
  ///   Identificador del proveedor.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingCashDebtsResponse?> mobileGetAccountingCashDebts({ bool? estado, String? proveedorId, String? moneda, int? page, int? limit, }) async {
    final response = await mobileGetAccountingCashDebtsWithHttpInfo( estado: estado, proveedorId: proveedorId, moneda: moneda, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingCashDebtsResponse',) as GetAccountingCashDebtsResponse;
    
    }
    return null;
  }

  /// Consultar deudas de efectivo
  ///
  /// Devuelve la deuda identificada con proveedor, cuenta por pagar y pagos relacionados.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetAccountingCashDebtsByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-debts/{id}'
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

  /// Consultar deudas de efectivo
  ///
  /// Devuelve la deuda identificada con proveedor, cuenta por pagar y pagos relacionados.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<GetAccountingCashDebtsIdResponse?> mobileGetAccountingCashDebtsById(String id,) async {
    final response = await mobileGetAccountingCashDebtsByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingCashDebtsIdResponse',) as GetAccountingCashDebtsIdResponse;
    
    }
    return null;
  }

  /// Consultar indicadores de deudas de efectivo
  ///
  /// Calcula cantidad, capital y saldo pendiente de las deudas de efectivo.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAccountingCashDebtsStatsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-debts/stats';

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

  /// Consultar indicadores de deudas de efectivo
  ///
  /// Calcula cantidad, capital y saldo pendiente de las deudas de efectivo.
  Future<GetAccountingCashDebtsStatsResponse?> mobileGetAccountingCashDebtsStats() async {
    final response = await mobileGetAccountingCashDebtsStatsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingCashDebtsStatsResponse',) as GetAccountingCashDebtsStatsResponse;
    
    }
    return null;
  }

  /// Consultar préstamos de efectivo
  ///
  /// Lista préstamos de efectivo otorgados a clientes, con vencimientos y saldos. Permite precisar la consulta mediante estado, cliente, moneda, página, límite por página.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingCashLoansWithHttpInfo({ bool? estado, String? clienteId, String? moneda, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-loans';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (estado != null) {
      queryParams.addAll(_queryParams('', 'estado', estado));
    }
    if (clienteId != null) {
      queryParams.addAll(_queryParams('', 'clienteId', clienteId));
    }
    if (moneda != null) {
      queryParams.addAll(_queryParams('', 'moneda', moneda));
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

  /// Consultar préstamos de efectivo
  ///
  /// Lista préstamos de efectivo otorgados a clientes, con vencimientos y saldos. Permite precisar la consulta mediante estado, cliente, moneda, página, límite por página.
  ///
  /// Parameters:
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingCashLoansResponse?> mobileGetAccountingCashLoans({ bool? estado, String? clienteId, String? moneda, int? page, int? limit, }) async {
    final response = await mobileGetAccountingCashLoansWithHttpInfo( estado: estado, clienteId: clienteId, moneda: moneda, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingCashLoansResponse',) as GetAccountingCashLoansResponse;
    
    }
    return null;
  }

  /// Consultar préstamos de efectivo
  ///
  /// Devuelve el préstamo identificado con cliente, cuenta por cobrar y pagos relacionados.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetAccountingCashLoansByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-loans/{id}'
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

  /// Consultar préstamos de efectivo
  ///
  /// Devuelve el préstamo identificado con cliente, cuenta por cobrar y pagos relacionados.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<GetAccountingCashLoansIdResponse?> mobileGetAccountingCashLoansById(String id,) async {
    final response = await mobileGetAccountingCashLoansByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingCashLoansIdResponse',) as GetAccountingCashLoansIdResponse;
    
    }
    return null;
  }

  /// Descargar comprobante de préstamos de efectivo
  ///
  /// Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetAccountingCashLoansByIdComprobanteWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-loans/{id}/comprobante'
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

  /// Descargar comprobante de préstamos de efectivo
  ///
  /// Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<MultipartFile?> mobileGetAccountingCashLoansByIdComprobante(String id,) async {
    final response = await mobileGetAccountingCashLoansByIdComprobanteWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'MultipartFile',) as MultipartFile;
    
    }
    return null;
  }

  /// Consultar historial de préstamos de efectivo
  ///
  /// Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetAccountingCashLoansByIdNestedHistoryWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-loans/{id}/history'
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

  /// Consultar historial de préstamos de efectivo
  ///
  /// Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<GetAccountingCashLoansIdHistoryResponse?> mobileGetAccountingCashLoansByIdNestedHistory(String id,) async {
    final response = await mobileGetAccountingCashLoansByIdNestedHistoryWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingCashLoansIdHistoryResponse',) as GetAccountingCashLoansIdHistoryResponse;
    
    }
    return null;
  }

  /// Consultar indicadores de préstamos de efectivo
  ///
  /// Calcula cantidad, capital y saldo pendiente de los préstamos de efectivo.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAccountingCashLoansStatsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-loans/stats';

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

  /// Consultar indicadores de préstamos de efectivo
  ///
  /// Calcula cantidad, capital y saldo pendiente de los préstamos de efectivo.
  Future<GetAccountingCashLoansStatsResponse?> mobileGetAccountingCashLoansStats() async {
    final response = await mobileGetAccountingCashLoansStatsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingCashLoansStatsResponse',) as GetAccountingCashLoansStatsResponse;
    
    }
    return null;
  }

  /// Registrar deudas de efectivo
  ///
  /// Registra financiamiento recibido de un proveedor, incrementa la cuenta bancaria y crea la cuenta por pagar.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [CashDebtCreateRequest] cashDebtCreateRequest (required):
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] proveedorId:
  ///   Identificador del proveedor.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobilePostAccountingCashDebtsWithHttpInfo(CashDebtCreateRequest cashDebtCreateRequest, { bool? estado, String? proveedorId, String? moneda, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-debts';

    // ignore: prefer_final_locals
    Object? postBody = cashDebtCreateRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (estado != null) {
      queryParams.addAll(_queryParams('', 'estado', estado));
    }
    if (proveedorId != null) {
      queryParams.addAll(_queryParams('', 'proveedorId', proveedorId));
    }
    if (moneda != null) {
      queryParams.addAll(_queryParams('', 'moneda', moneda));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
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

  /// Registrar deudas de efectivo
  ///
  /// Registra financiamiento recibido de un proveedor, incrementa la cuenta bancaria y crea la cuenta por pagar.
  ///
  /// Parameters:
  ///
  /// * [CashDebtCreateRequest] cashDebtCreateRequest (required):
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] proveedorId:
  ///   Identificador del proveedor.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<PostAccountingCashDebtsResponse?> mobilePostAccountingCashDebts(CashDebtCreateRequest cashDebtCreateRequest, { bool? estado, String? proveedorId, String? moneda, int? page, int? limit, }) async {
    final response = await mobilePostAccountingCashDebtsWithHttpInfo(cashDebtCreateRequest,  estado: estado, proveedorId: proveedorId, moneda: moneda, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingCashDebtsResponse',) as PostAccountingCashDebtsResponse;
    
    }
    return null;
  }

  /// Registrar pago de deudas de efectivo
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
  /// * [CashPaymentRequest] cashPaymentRequest (required):
  Future<Response> mobilePostAccountingCashDebtsByIdPaymentsWithHttpInfo(String id, CashPaymentRequest cashPaymentRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-debts/{id}/payments'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = cashPaymentRequest;

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

  /// Registrar pago de deudas de efectivo
  ///
  /// Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [CashPaymentRequest] cashPaymentRequest (required):
  Future<PostAccountingCashDebtsIdPaymentsResponse?> mobilePostAccountingCashDebtsByIdPayments(String id, CashPaymentRequest cashPaymentRequest,) async {
    final response = await mobilePostAccountingCashDebtsByIdPaymentsWithHttpInfo(id, cashPaymentRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingCashDebtsIdPaymentsResponse',) as PostAccountingCashDebtsIdPaymentsResponse;
    
    }
    return null;
  }

  /// Registrar préstamos de efectivo
  ///
  /// Registra un préstamo a un cliente, descuenta fondos de la cuenta bancaria y crea la cuenta por cobrar.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [CashLoanCreateRequest] cashLoanCreateRequest (required):
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobilePostAccountingCashLoansWithHttpInfo(CashLoanCreateRequest cashLoanCreateRequest, { bool? estado, String? clienteId, String? moneda, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-loans';

    // ignore: prefer_final_locals
    Object? postBody = cashLoanCreateRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (estado != null) {
      queryParams.addAll(_queryParams('', 'estado', estado));
    }
    if (clienteId != null) {
      queryParams.addAll(_queryParams('', 'clienteId', clienteId));
    }
    if (moneda != null) {
      queryParams.addAll(_queryParams('', 'moneda', moneda));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
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

  /// Registrar préstamos de efectivo
  ///
  /// Registra un préstamo a un cliente, descuenta fondos de la cuenta bancaria y crea la cuenta por cobrar.
  ///
  /// Parameters:
  ///
  /// * [CashLoanCreateRequest] cashLoanCreateRequest (required):
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<PostAccountingCashLoansResponse?> mobilePostAccountingCashLoans(CashLoanCreateRequest cashLoanCreateRequest, { bool? estado, String? clienteId, String? moneda, int? page, int? limit, }) async {
    final response = await mobilePostAccountingCashLoansWithHttpInfo(cashLoanCreateRequest,  estado: estado, clienteId: clienteId, moneda: moneda, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingCashLoansResponse',) as PostAccountingCashLoansResponse;
    
    }
    return null;
  }

  /// Registrar pago de préstamos de efectivo
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
  /// * [CashPaymentRequest] cashPaymentRequest (required):
  Future<Response> mobilePostAccountingCashLoansByIdPaymentsWithHttpInfo(String id, CashPaymentRequest cashPaymentRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-loans/{id}/payments'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = cashPaymentRequest;

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

  /// Registrar pago de préstamos de efectivo
  ///
  /// Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [CashPaymentRequest] cashPaymentRequest (required):
  Future<PostAccountingCashLoansIdPaymentsResponse?> mobilePostAccountingCashLoansByIdPayments(String id, CashPaymentRequest cashPaymentRequest,) async {
    final response = await mobilePostAccountingCashLoansByIdPaymentsWithHttpInfo(id, cashPaymentRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingCashLoansIdPaymentsResponse',) as PostAccountingCashLoansIdPaymentsResponse;
    
    }
    return null;
  }

  /// Actualizar deudas de efectivo
  ///
  /// Actualiza vencimiento, tasa de interés u observaciones de la deuda identificada.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [CashOperationUpdateRequest] cashOperationUpdateRequest (required):
  Future<Response> mobilePutAccountingCashDebtsByIdWithHttpInfo(String id, CashOperationUpdateRequest cashOperationUpdateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-debts/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = cashOperationUpdateRequest;

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

  /// Actualizar deudas de efectivo
  ///
  /// Actualiza vencimiento, tasa de interés u observaciones de la deuda identificada.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [CashOperationUpdateRequest] cashOperationUpdateRequest (required):
  Future<PutAccountingCashDebtsIdResponse?> mobilePutAccountingCashDebtsById(String id, CashOperationUpdateRequest cashOperationUpdateRequest,) async {
    final response = await mobilePutAccountingCashDebtsByIdWithHttpInfo(id, cashOperationUpdateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PutAccountingCashDebtsIdResponse',) as PutAccountingCashDebtsIdResponse;
    
    }
    return null;
  }

  /// Actualizar préstamos de efectivo
  ///
  /// Actualiza vencimiento, tasa de interés u observaciones del préstamo identificado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [CashOperationUpdateRequest] cashOperationUpdateRequest (required):
  Future<Response> mobilePutAccountingCashLoansByIdWithHttpInfo(String id, CashOperationUpdateRequest cashOperationUpdateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/cash-loans/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = cashOperationUpdateRequest;

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

  /// Actualizar préstamos de efectivo
  ///
  /// Actualiza vencimiento, tasa de interés u observaciones del préstamo identificado.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [CashOperationUpdateRequest] cashOperationUpdateRequest (required):
  Future<PutAccountingCashLoansIdResponse?> mobilePutAccountingCashLoansById(String id, CashOperationUpdateRequest cashOperationUpdateRequest,) async {
    final response = await mobilePutAccountingCashLoansByIdWithHttpInfo(id, cashOperationUpdateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PutAccountingCashLoansIdResponse',) as PutAccountingCashLoansIdResponse;
    
    }
    return null;
  }
}
