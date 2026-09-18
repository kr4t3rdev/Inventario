//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class AccountingAdvancesApi {
  AccountingAdvancesApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Eliminar anticipo
  ///
  /// Elimina el anticipo identificado después de comprobar que pertenece al tenant.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileDeleteAccountingAdvancesByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances/{id}'
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

  /// Eliminar anticipo
  ///
  /// Elimina el anticipo identificado después de comprobar que pertenece al tenant.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<DeleteAccountingAdvancesIdResponse?> mobileDeleteAccountingAdvancesById(String id,) async {
    final response = await mobileDeleteAccountingAdvancesByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DeleteAccountingAdvancesIdResponse',) as DeleteAccountingAdvancesIdResponse;
    
    }
    return null;
  }

  /// Consultar anticipos
  ///
  /// Consulta anticipos de pago o cobro con su saldo disponible y vigencia.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAccountingAdvancesWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances';

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

  /// Consultar anticipos
  ///
  /// Consulta anticipos de pago o cobro con su saldo disponible y vigencia.
  Future<GetAccountingAdvancesResponse?> mobileGetAccountingAdvances() async {
    final response = await mobileGetAccountingAdvancesWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingAdvancesResponse',) as GetAccountingAdvancesResponse;
    
    }
    return null;
  }

  /// Consultar anticipos disponibles
  ///
  /// Busca anticipos reservados con saldo que todavía pueden aplicarse a una compra o factura. Permite precisar la consulta mediante contexto de uso, proveedor, cliente, moneda, estado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] contexto:
  ///   Valor de contexto aceptado por el handler.
  ///
  /// * [String] proveedorId:
  ///   Identificador del proveedor.
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  Future<Response> mobileGetAccountingAdvancesAvailableWithHttpInfo({ String? contexto, String? proveedorId, String? clienteId, String? moneda, bool? estado, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances/available';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (contexto != null) {
      queryParams.addAll(_queryParams('', 'contexto', contexto));
    }
    if (proveedorId != null) {
      queryParams.addAll(_queryParams('', 'proveedorId', proveedorId));
    }
    if (clienteId != null) {
      queryParams.addAll(_queryParams('', 'clienteId', clienteId));
    }
    if (moneda != null) {
      queryParams.addAll(_queryParams('', 'moneda', moneda));
    }
    if (estado != null) {
      queryParams.addAll(_queryParams('', 'estado', estado));
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

  /// Consultar anticipos disponibles
  ///
  /// Busca anticipos reservados con saldo que todavía pueden aplicarse a una compra o factura. Permite precisar la consulta mediante contexto de uso, proveedor, cliente, moneda, estado.
  ///
  /// Parameters:
  ///
  /// * [String] contexto:
  ///   Valor de contexto aceptado por el handler.
  ///
  /// * [String] proveedorId:
  ///   Identificador del proveedor.
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [bool] estado:
  ///   Estado usado para filtrar resultados.
  Future<GetAccountingAdvancesAvailableResponse?> mobileGetAccountingAdvancesAvailable({ String? contexto, String? proveedorId, String? clienteId, String? moneda, bool? estado, }) async {
    final response = await mobileGetAccountingAdvancesAvailableWithHttpInfo( contexto: contexto, proveedorId: proveedorId, clienteId: clienteId, moneda: moneda, estado: estado, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingAdvancesAvailableResponse',) as GetAccountingAdvancesAvailableResponse;
    
    }
    return null;
  }

  /// Consultar anticipo
  ///
  /// Devuelve el anticipo solicitado con contrato, contraparte y movimientos relacionados.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetAccountingAdvancesByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances/{id}'
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

  /// Consultar anticipo
  ///
  /// Devuelve el anticipo solicitado con contrato, contraparte y movimientos relacionados.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<GetAccountingAdvancesIdResponse?> mobileGetAccountingAdvancesById(String id,) async {
    final response = await mobileGetAccountingAdvancesByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingAdvancesIdResponse',) as GetAccountingAdvancesIdResponse;
    
    }
    return null;
  }

  /// Registrar anticipos
  ///
  /// Crea una reserva de anticipo de pago o cobro, vinculada al contrato y contraparte indicados.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [AccountingAdvancesPostRequest] accountingAdvancesPostRequest (required):
  Future<Response> mobilePostAccountingAdvancesWithHttpInfo(AccountingAdvancesPostRequest accountingAdvancesPostRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances';

    // ignore: prefer_final_locals
    Object? postBody = accountingAdvancesPostRequest;

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

  /// Registrar anticipos
  ///
  /// Crea una reserva de anticipo de pago o cobro, vinculada al contrato y contraparte indicados.
  ///
  /// Parameters:
  ///
  /// * [AccountingAdvancesPostRequest] accountingAdvancesPostRequest (required):
  Future<PostAccountingAdvancesResponse?> mobilePostAccountingAdvances(AccountingAdvancesPostRequest accountingAdvancesPostRequest,) async {
    final response = await mobilePostAccountingAdvancesWithHttpInfo(accountingAdvancesPostRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingAdvancesResponse',) as PostAccountingAdvancesResponse;
    
    }
    return null;
  }

  /// Ejecutar anticipo reservado
  ///
  /// Aplica el saldo completo del anticipo al documento destino con control de idempotencia y período contable.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [AccountingAdvancesIdEjecutarPostRequest] accountingAdvancesIdEjecutarPostRequest (required):
  Future<Response> mobilePostAccountingAdvancesByIdEjecutarWithHttpInfo(String id, AccountingAdvancesIdEjecutarPostRequest accountingAdvancesIdEjecutarPostRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances/{id}/ejecutar'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = accountingAdvancesIdEjecutarPostRequest;

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

  /// Ejecutar anticipo reservado
  ///
  /// Aplica el saldo completo del anticipo al documento destino con control de idempotencia y período contable.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [AccountingAdvancesIdEjecutarPostRequest] accountingAdvancesIdEjecutarPostRequest (required):
  Future<PostAccountingAdvancesIdEjecutarResponse?> mobilePostAccountingAdvancesByIdEjecutar(String id, AccountingAdvancesIdEjecutarPostRequest accountingAdvancesIdEjecutarPostRequest,) async {
    final response = await mobilePostAccountingAdvancesByIdEjecutarWithHttpInfo(id, accountingAdvancesIdEjecutarPostRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingAdvancesIdEjecutarResponse',) as PostAccountingAdvancesIdEjecutarResponse;
    
    }
    return null;
  }

  /// Revertir ejecución de anticipo
  ///
  /// Revierte el importe aplicado al documento destino y restablece el estado contable correspondiente.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [AccountingAdvancesIdRevertirPostRequest] accountingAdvancesIdRevertirPostRequest (required):
  Future<Response> mobilePostAccountingAdvancesByIdRevertirWithHttpInfo(String id, AccountingAdvancesIdRevertirPostRequest accountingAdvancesIdRevertirPostRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances/{id}/revertir'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = accountingAdvancesIdRevertirPostRequest;

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

  /// Revertir ejecución de anticipo
  ///
  /// Revierte el importe aplicado al documento destino y restablece el estado contable correspondiente.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [AccountingAdvancesIdRevertirPostRequest] accountingAdvancesIdRevertirPostRequest (required):
  Future<PostAccountingAdvancesIdRevertirResponse?> mobilePostAccountingAdvancesByIdRevertir(String id, AccountingAdvancesIdRevertirPostRequest accountingAdvancesIdRevertirPostRequest,) async {
    final response = await mobilePostAccountingAdvancesByIdRevertirWithHttpInfo(id, accountingAdvancesIdRevertirPostRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingAdvancesIdRevertirResponse',) as PostAccountingAdvancesIdRevertirResponse;
    
    }
    return null;
  }

  /// Actualizar anticipo
  ///
  /// Modifica estado, saldo disponible, vigencia o referencia externa del anticipo existente.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [AccountingAdvancesIdPutRequest] accountingAdvancesIdPutRequest (required):
  Future<Response> mobilePutAccountingAdvancesByIdWithHttpInfo(String id, AccountingAdvancesIdPutRequest accountingAdvancesIdPutRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = accountingAdvancesIdPutRequest;

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

  /// Actualizar anticipo
  ///
  /// Modifica estado, saldo disponible, vigencia o referencia externa del anticipo existente.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [AccountingAdvancesIdPutRequest] accountingAdvancesIdPutRequest (required):
  Future<PutAccountingAdvancesIdResponse?> mobilePutAccountingAdvancesById(String id, AccountingAdvancesIdPutRequest accountingAdvancesIdPutRequest,) async {
    final response = await mobilePutAccountingAdvancesByIdWithHttpInfo(id, accountingAdvancesIdPutRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PutAccountingAdvancesIdResponse',) as PutAccountingAdvancesIdResponse;
    
    }
    return null;
  }
}
