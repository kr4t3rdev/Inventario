//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AccountingAdvancesIdEjecutarPostRequest {
  /// Returns a new [AccountingAdvancesIdEjecutarPostRequest] instance.
  AccountingAdvancesIdEjecutarPostRequest({
    required this.contexto,
    required this.documentoDestinoId,
    required this.montoObjetivo,
    required this.monedaObjetivo,
    this.tasaAplicada,
    required this.idempotencyKey,
    this.observaciones,
  });

  String contexto;

  String documentoDestinoId;

  num montoObjetivo;

  String monedaObjetivo;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? tasaAplicada;

  String idempotencyKey;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? observaciones;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AccountingAdvancesIdEjecutarPostRequest &&
    other.contexto == contexto &&
    other.documentoDestinoId == documentoDestinoId &&
    other.montoObjetivo == montoObjetivo &&
    other.monedaObjetivo == monedaObjetivo &&
    other.tasaAplicada == tasaAplicada &&
    other.idempotencyKey == idempotencyKey &&
    other.observaciones == observaciones;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (contexto.hashCode) +
    (documentoDestinoId.hashCode) +
    (montoObjetivo.hashCode) +
    (monedaObjetivo.hashCode) +
    (tasaAplicada == null ? 0 : tasaAplicada!.hashCode) +
    (idempotencyKey.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode);

  @override
  String toString() => 'AccountingAdvancesIdEjecutarPostRequest[contexto=$contexto, documentoDestinoId=$documentoDestinoId, montoObjetivo=$montoObjetivo, monedaObjetivo=$monedaObjetivo, tasaAplicada=$tasaAplicada, idempotencyKey=$idempotencyKey, observaciones=$observaciones]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'contexto'] = this.contexto;
      json[r'documentoDestinoId'] = this.documentoDestinoId;
      json[r'montoObjetivo'] = this.montoObjetivo;
      json[r'monedaObjetivo'] = this.monedaObjetivo;
    if (this.tasaAplicada != null) {
      json[r'tasaAplicada'] = this.tasaAplicada;
    } else {
      json[r'tasaAplicada'] = null;
    }
      json[r'idempotencyKey'] = this.idempotencyKey;
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
    return json;
  }

  /// Returns a new [AccountingAdvancesIdEjecutarPostRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AccountingAdvancesIdEjecutarPostRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AccountingAdvancesIdEjecutarPostRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AccountingAdvancesIdEjecutarPostRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AccountingAdvancesIdEjecutarPostRequest(
        contexto: mapValueOfType<String>(json, r'contexto')!,
        documentoDestinoId: mapValueOfType<String>(json, r'documentoDestinoId')!,
        montoObjetivo: num.parse('${json[r'montoObjetivo']}'),
        monedaObjetivo: mapValueOfType<String>(json, r'monedaObjetivo')!,
        tasaAplicada: num.parse('${json[r'tasaAplicada']}'),
        idempotencyKey: mapValueOfType<String>(json, r'idempotencyKey')!,
        observaciones: mapValueOfType<String>(json, r'observaciones'),
      );
    }
    return null;
  }

  static List<AccountingAdvancesIdEjecutarPostRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AccountingAdvancesIdEjecutarPostRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AccountingAdvancesIdEjecutarPostRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AccountingAdvancesIdEjecutarPostRequest> mapFromJson(dynamic json) {
    final map = <String, AccountingAdvancesIdEjecutarPostRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AccountingAdvancesIdEjecutarPostRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AccountingAdvancesIdEjecutarPostRequest-objects as value to a dart map
  static Map<String, List<AccountingAdvancesIdEjecutarPostRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AccountingAdvancesIdEjecutarPostRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AccountingAdvancesIdEjecutarPostRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'contexto',
    'documentoDestinoId',
    'montoObjetivo',
    'monedaObjetivo',
    'idempotencyKey',
  };
}

