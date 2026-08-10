//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class AccountingBankingApi {
  AccountingBankingApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar cuentas bancarias
  ///
  /// Lista las cuentas bancarias activas disponibles para operaciones contables.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAccountingBankAccountsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/bank-accounts';

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

  /// Consultar cuentas bancarias
  ///
  /// Lista las cuentas bancarias activas disponibles para operaciones contables.
  Future<GetAccountingBankAccountsResponse?> mobileGetAccountingBankAccounts() async {
    final response = await mobileGetAccountingBankAccountsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingBankAccountsResponse',) as GetAccountingBankAccountsResponse;
    
    }
    return null;
  }

  /// Consultar cuentas bancaria
  ///
  /// Devuelve datos, saldo y moneda de la cuenta bancaria identificada.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetAccountingBankAccountsByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/bank-accounts/{id}'
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

  /// Consultar cuentas bancaria
  ///
  /// Devuelve datos, saldo y moneda de la cuenta bancaria identificada.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<GetAccountingBankAccountsIdResponse?> mobileGetAccountingBankAccountsById(String id,) async {
    final response = await mobileGetAccountingBankAccountsByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingBankAccountsIdResponse',) as GetAccountingBankAccountsIdResponse;
    
    }
    return null;
  }

  /// Consultar historial de cuentas bancarias
  ///
  /// Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] tipoMovimiento:
  ///   Valor de tipoMovimiento aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingBankAccountsByIdNestedHistoryWithHttpInfo(String id, { DateTime? fechaInicio, DateTime? fechaFin, String? tipoMovimiento, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/bank-accounts/{id}/history'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
    }
    if (tipoMovimiento != null) {
      queryParams.addAll(_queryParams('', 'tipoMovimiento', tipoMovimiento));
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

  /// Consultar historial de cuentas bancarias
  ///
  /// Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] tipoMovimiento:
  ///   Valor de tipoMovimiento aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingBankAccountsIdHistoryResponse?> mobileGetAccountingBankAccountsByIdNestedHistory(String id, { DateTime? fechaInicio, DateTime? fechaFin, String? tipoMovimiento, int? page, int? limit, }) async {
    final response = await mobileGetAccountingBankAccountsByIdNestedHistoryWithHttpInfo(id,  fechaInicio: fechaInicio, fechaFin: fechaFin, tipoMovimiento: tipoMovimiento, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingBankAccountsIdHistoryResponse',) as GetAccountingBankAccountsIdHistoryResponse;
    
    }
    return null;
  }

  /// Consultar ajustes bancarios
  ///
  /// Lista ingresos y egresos manuales registrados sobre cuentas bancarias. Permite precisar la consulta mediante cuenta bancaria, tipo, fecha inicial, fecha final, página, límite por página.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingBankAdjustmentsWithHttpInfo({ String? cuentaId, String? tipo, DateTime? fechaInicio, DateTime? fechaFin, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/bank-adjustments';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
    }
    if (tipo != null) {
      queryParams.addAll(_queryParams('', 'tipo', tipo));
    }
    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
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

  /// Consultar ajustes bancarios
  ///
  /// Lista ingresos y egresos manuales registrados sobre cuentas bancarias. Permite precisar la consulta mediante cuenta bancaria, tipo, fecha inicial, fecha final, página, límite por página.
  ///
  /// Parameters:
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingBankAdjustmentsResponse?> mobileGetAccountingBankAdjustments({ String? cuentaId, String? tipo, DateTime? fechaInicio, DateTime? fechaFin, int? page, int? limit, }) async {
    final response = await mobileGetAccountingBankAdjustmentsWithHttpInfo( cuentaId: cuentaId, tipo: tipo, fechaInicio: fechaInicio, fechaFin: fechaFin, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingBankAdjustmentsResponse',) as GetAccountingBankAdjustmentsResponse;
    
    }
    return null;
  }

  /// Consultar transferencias bancarias
  ///
  /// Lista transferencias entre cuentas con importes de origen, destino y tasa aplicada. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<Response> mobileGetAccountingBankTransfersWithHttpInfo({ DateTime? fechaInicio, DateTime? fechaFin, String? cuentaId, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/bank-transfers';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
    }
    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
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

  /// Consultar transferencias bancarias
  ///
  /// Lista transferencias entre cuentas con importes de origen, destino y tasa aplicada. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<GetAccountingBankTransfersResponse?> mobileGetAccountingBankTransfers({ DateTime? fechaInicio, DateTime? fechaFin, String? cuentaId, }) async {
    final response = await mobileGetAccountingBankTransfersWithHttpInfo( fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaId: cuentaId, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingBankTransfersResponse',) as GetAccountingBankTransfersResponse;
    
    }
    return null;
  }

  /// Consultar transferencias bancaria
  ///
  /// Devuelve importes, cuentas, moneda, tasa y comprobante de la transferencia identificada.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetAccountingBankTransfersByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/bank-transfers/{id}'
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

  /// Consultar transferencias bancaria
  ///
  /// Devuelve importes, cuentas, moneda, tasa y comprobante de la transferencia identificada.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<GetAccountingBankTransfersIdResponse?> mobileGetAccountingBankTransfersById(String id,) async {
    final response = await mobileGetAccountingBankTransfersByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingBankTransfersIdResponse',) as GetAccountingBankTransfersIdResponse;
    
    }
    return null;
  }

  /// Descargar comprobante de transferencias bancarias
  ///
  /// Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetAccountingBankTransfersByIdComprobanteWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/bank-transfers/{id}/comprobante'
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

  /// Descargar comprobante de transferencias bancarias
  ///
  /// Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<MultipartFile?> mobileGetAccountingBankTransfersByIdComprobante(String id,) async {
    final response = await mobileGetAccountingBankTransfersByIdComprobanteWithHttpInfo(id,);
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

  /// Registrar ajustes bancarios
  ///
  /// Registra un ingreso o egreso manual y actualiza el saldo de la cuenta bancaria seleccionada.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [BankAdjustmentRequest] bankAdjustmentRequest (required):
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobilePostAccountingBankAdjustmentsWithHttpInfo(BankAdjustmentRequest bankAdjustmentRequest, { String? cuentaId, String? tipo, DateTime? fechaInicio, DateTime? fechaFin, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/bank-adjustments';

    // ignore: prefer_final_locals
    Object? postBody = bankAdjustmentRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
    }
    if (tipo != null) {
      queryParams.addAll(_queryParams('', 'tipo', tipo));
    }
    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
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

  /// Registrar ajustes bancarios
  ///
  /// Registra un ingreso o egreso manual y actualiza el saldo de la cuenta bancaria seleccionada.
  ///
  /// Parameters:
  ///
  /// * [BankAdjustmentRequest] bankAdjustmentRequest (required):
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<PostAccountingBankAdjustmentsResponse?> mobilePostAccountingBankAdjustments(BankAdjustmentRequest bankAdjustmentRequest, { String? cuentaId, String? tipo, DateTime? fechaInicio, DateTime? fechaFin, int? page, int? limit, }) async {
    final response = await mobilePostAccountingBankAdjustmentsWithHttpInfo(bankAdjustmentRequest,  cuentaId: cuentaId, tipo: tipo, fechaInicio: fechaInicio, fechaFin: fechaFin, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingBankAdjustmentsResponse',) as PostAccountingBankAdjustmentsResponse;
    
    }
    return null;
  }

  /// Registrar transferencias bancarias
  ///
  /// Transfiere fondos entre dos cuentas, aplicando conversión cuando las monedas son diferentes.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [BankTransferCreateRequest] bankTransferCreateRequest (required):
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<Response> mobilePostAccountingBankTransfersWithHttpInfo(BankTransferCreateRequest bankTransferCreateRequest, { DateTime? fechaInicio, DateTime? fechaFin, String? cuentaId, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/bank-transfers';

    // ignore: prefer_final_locals
    Object? postBody = bankTransferCreateRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
    }
    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
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

  /// Registrar transferencias bancarias
  ///
  /// Transfiere fondos entre dos cuentas, aplicando conversión cuando las monedas son diferentes.
  ///
  /// Parameters:
  ///
  /// * [BankTransferCreateRequest] bankTransferCreateRequest (required):
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<PostAccountingBankTransfersResponse?> mobilePostAccountingBankTransfers(BankTransferCreateRequest bankTransferCreateRequest, { DateTime? fechaInicio, DateTime? fechaFin, String? cuentaId, }) async {
    final response = await mobilePostAccountingBankTransfersWithHttpInfo(bankTransferCreateRequest,  fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaId: cuentaId, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingBankTransfersResponse',) as PostAccountingBankTransfersResponse;
    
    }
    return null;
  }

  /// Validar transferencia bancaria
  ///
  /// Comprueba cuentas, monedas, saldo e importes antes de registrar una transferencia.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [BankTransferValidationRequest] bankTransferValidationRequest (required):
  Future<Response> mobilePostAccountingBankTransfersValidateWithHttpInfo(BankTransferValidationRequest bankTransferValidationRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/bank-transfers/validate';

    // ignore: prefer_final_locals
    Object? postBody = bankTransferValidationRequest;

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

  /// Validar transferencia bancaria
  ///
  /// Comprueba cuentas, monedas, saldo e importes antes de registrar una transferencia.
  ///
  /// Parameters:
  ///
  /// * [BankTransferValidationRequest] bankTransferValidationRequest (required):
  Future<PostAccountingBankTransfersValidateResponse?> mobilePostAccountingBankTransfersValidate(BankTransferValidationRequest bankTransferValidationRequest,) async {
    final response = await mobilePostAccountingBankTransfersValidateWithHttpInfo(bankTransferValidationRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingBankTransfersValidateResponse',) as PostAccountingBankTransfersValidateResponse;
    
    }
    return null;
  }
}
