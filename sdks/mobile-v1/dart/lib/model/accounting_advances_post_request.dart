//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AccountingAdvancesPostRequest {
  /// Returns a new [AccountingAdvancesPostRequest] instance.
  AccountingAdvancesPostRequest({
    required this.tipo,
    required this.contratoId,
    this.proveedorId,
    this.clienteId,
    required this.monto,
    required this.moneda,
    this.cuentaOrigenId,
    this.tipoPagoOrigenId,
    this.referenciaExterna,
    this.vigenciaHasta,
  });

  String tipo;

  String contratoId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? proveedorId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? clienteId;

  num monto;

  String moneda;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? cuentaOrigenId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? tipoPagoOrigenId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? referenciaExterna;

  DateTime? vigenciaHasta;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AccountingAdvancesPostRequest &&
    other.tipo == tipo &&
    other.contratoId == contratoId &&
    other.proveedorId == proveedorId &&
    other.clienteId == clienteId &&
    other.monto == monto &&
    other.moneda == moneda &&
    other.cuentaOrigenId == cuentaOrigenId &&
    other.tipoPagoOrigenId == tipoPagoOrigenId &&
    other.referenciaExterna == referenciaExterna &&
    other.vigenciaHasta == vigenciaHasta;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tipo.hashCode) +
    (contratoId.hashCode) +
    (proveedorId == null ? 0 : proveedorId!.hashCode) +
    (clienteId == null ? 0 : clienteId!.hashCode) +
    (monto.hashCode) +
    (moneda.hashCode) +
    (cuentaOrigenId == null ? 0 : cuentaOrigenId!.hashCode) +
    (tipoPagoOrigenId == null ? 0 : tipoPagoOrigenId!.hashCode) +
    (referenciaExterna == null ? 0 : referenciaExterna!.hashCode) +
    (vigenciaHasta == null ? 0 : vigenciaHasta!.hashCode);

  @override
  String toString() => 'AccountingAdvancesPostRequest[tipo=$tipo, contratoId=$contratoId, proveedorId=$proveedorId, clienteId=$clienteId, monto=$monto, moneda=$moneda, cuentaOrigenId=$cuentaOrigenId, tipoPagoOrigenId=$tipoPagoOrigenId, referenciaExterna=$referenciaExterna, vigenciaHasta=$vigenciaHasta]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tipo'] = this.tipo;
      json[r'contratoId'] = this.contratoId;
    if (this.proveedorId != null) {
      json[r'proveedorId'] = this.proveedorId;
    } else {
      json[r'proveedorId'] = null;
    }
    if (this.clienteId != null) {
      json[r'clienteId'] = this.clienteId;
    } else {
      json[r'clienteId'] = null;
    }
      json[r'monto'] = this.monto;
      json[r'moneda'] = this.moneda;
    if (this.cuentaOrigenId != null) {
      json[r'cuentaOrigenId'] = this.cuentaOrigenId;
    } else {
      json[r'cuentaOrigenId'] = null;
    }
    if (this.tipoPagoOrigenId != null) {
      json[r'tipoPagoOrigenId'] = this.tipoPagoOrigenId;
    } else {
      json[r'tipoPagoOrigenId'] = null;
    }
    if (this.referenciaExterna != null) {
      json[r'referenciaExterna'] = this.referenciaExterna;
    } else {
      json[r'referenciaExterna'] = null;
    }
    if (this.vigenciaHasta != null) {
      json[r'vigenciaHasta'] = this.vigenciaHasta!.toUtc().toIso8601String();
    } else {
      json[r'vigenciaHasta'] = null;
    }
    return json;
  }

  /// Returns a new [AccountingAdvancesPostRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AccountingAdvancesPostRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AccountingAdvancesPostRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AccountingAdvancesPostRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AccountingAdvancesPostRequest(
        tipo: mapValueOfType<String>(json, r'tipo')!,
        contratoId: mapValueOfType<String>(json, r'contratoId')!,
        proveedorId: mapValueOfType<String>(json, r'proveedorId'),
        clienteId: mapValueOfType<String>(json, r'clienteId'),
        monto: num.parse('${json[r'monto']}'),
        moneda: mapValueOfType<String>(json, r'moneda')!,
        cuentaOrigenId: mapValueOfType<String>(json, r'cuentaOrigenId'),
        tipoPagoOrigenId: mapValueOfType<String>(json, r'tipoPagoOrigenId'),
        referenciaExterna: mapValueOfType<String>(json, r'referenciaExterna'),
        vigenciaHasta: mapDateTime(json, r'vigenciaHasta', r''),
      );
    }
    return null;
  }

  static List<AccountingAdvancesPostRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AccountingAdvancesPostRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AccountingAdvancesPostRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AccountingAdvancesPostRequest> mapFromJson(dynamic json) {
    final map = <String, AccountingAdvancesPostRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AccountingAdvancesPostRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AccountingAdvancesPostRequest-objects as value to a dart map
  static Map<String, List<AccountingAdvancesPostRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AccountingAdvancesPostRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AccountingAdvancesPostRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tipo',
    'contratoId',
    'monto',
    'moneda',
  };
}

