//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class CashLoanCreateRequest {
  /// Returns a new [CashLoanCreateRequest] instance.
  CashLoanCreateRequest({
    required this.clienteId,
    required this.montoCapital,
    this.moneda,
    this.tasaInteres,
    this.tasaCambioAlCrear,
    this.fechaVencimiento,
    this.observaciones,
    required this.cuentaBancariaId,
  });

  String clienteId;

  num montoCapital;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? moneda;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? tasaInteres;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? tasaCambioAlCrear;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? fechaVencimiento;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? observaciones;

  String cuentaBancariaId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is CashLoanCreateRequest &&
    other.clienteId == clienteId &&
    other.montoCapital == montoCapital &&
    other.moneda == moneda &&
    other.tasaInteres == tasaInteres &&
    other.tasaCambioAlCrear == tasaCambioAlCrear &&
    other.fechaVencimiento == fechaVencimiento &&
    other.observaciones == observaciones &&
    other.cuentaBancariaId == cuentaBancariaId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (clienteId.hashCode) +
    (montoCapital.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (tasaInteres == null ? 0 : tasaInteres!.hashCode) +
    (tasaCambioAlCrear == null ? 0 : tasaCambioAlCrear!.hashCode) +
    (fechaVencimiento == null ? 0 : fechaVencimiento!.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode) +
    (cuentaBancariaId.hashCode);

  @override
  String toString() => 'CashLoanCreateRequest[clienteId=$clienteId, montoCapital=$montoCapital, moneda=$moneda, tasaInteres=$tasaInteres, tasaCambioAlCrear=$tasaCambioAlCrear, fechaVencimiento=$fechaVencimiento, observaciones=$observaciones, cuentaBancariaId=$cuentaBancariaId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'clienteId'] = this.clienteId;
      json[r'montoCapital'] = this.montoCapital;
    if (this.moneda != null) {
      json[r'moneda'] = this.moneda;
    } else {
      json[r'moneda'] = null;
    }
    if (this.tasaInteres != null) {
      json[r'tasaInteres'] = this.tasaInteres;
    } else {
      json[r'tasaInteres'] = null;
    }
    if (this.tasaCambioAlCrear != null) {
      json[r'tasaCambioAlCrear'] = this.tasaCambioAlCrear;
    } else {
      json[r'tasaCambioAlCrear'] = null;
    }
    if (this.fechaVencimiento != null) {
      json[r'fechaVencimiento'] = this.fechaVencimiento!.toUtc().toIso8601String();
    } else {
      json[r'fechaVencimiento'] = null;
    }
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
      json[r'cuentaBancariaId'] = this.cuentaBancariaId;
    return json;
  }

  /// Returns a new [CashLoanCreateRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static CashLoanCreateRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "CashLoanCreateRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "CashLoanCreateRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return CashLoanCreateRequest(
        clienteId: mapValueOfType<String>(json, r'clienteId')!,
        montoCapital: num.parse('${json[r'montoCapital']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        tasaInteres: num.parse('${json[r'tasaInteres']}'),
        tasaCambioAlCrear: num.parse('${json[r'tasaCambioAlCrear']}'),
        fechaVencimiento: mapDateTime(json, r'fechaVencimiento', r''),
        observaciones: mapValueOfType<String>(json, r'observaciones'),
        cuentaBancariaId: mapValueOfType<String>(json, r'cuentaBancariaId')!,
      );
    }
    return null;
  }

  static List<CashLoanCreateRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <CashLoanCreateRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = CashLoanCreateRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, CashLoanCreateRequest> mapFromJson(dynamic json) {
    final map = <String, CashLoanCreateRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = CashLoanCreateRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of CashLoanCreateRequest-objects as value to a dart map
  static Map<String, List<CashLoanCreateRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<CashLoanCreateRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = CashLoanCreateRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'clienteId',
    'montoCapital',
    'cuentaBancariaId',
  };
}

