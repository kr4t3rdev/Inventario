//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class CashDebtCreateRequest {
  /// Returns a new [CashDebtCreateRequest] instance.
  CashDebtCreateRequest({
    required this.proveedorId,
    required this.montoCapital,
    this.moneda,
    this.tasaInteres,
    this.fechaVencimiento,
    this.observaciones,
    this.comprobanteUrl,
    required this.cuentaBancariaId,
  });

  String proveedorId;

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
  DateTime? fechaVencimiento;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? observaciones;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? comprobanteUrl;

  String cuentaBancariaId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is CashDebtCreateRequest &&
    other.proveedorId == proveedorId &&
    other.montoCapital == montoCapital &&
    other.moneda == moneda &&
    other.tasaInteres == tasaInteres &&
    other.fechaVencimiento == fechaVencimiento &&
    other.observaciones == observaciones &&
    other.comprobanteUrl == comprobanteUrl &&
    other.cuentaBancariaId == cuentaBancariaId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (proveedorId.hashCode) +
    (montoCapital.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (tasaInteres == null ? 0 : tasaInteres!.hashCode) +
    (fechaVencimiento == null ? 0 : fechaVencimiento!.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode) +
    (comprobanteUrl == null ? 0 : comprobanteUrl!.hashCode) +
    (cuentaBancariaId.hashCode);

  @override
  String toString() => 'CashDebtCreateRequest[proveedorId=$proveedorId, montoCapital=$montoCapital, moneda=$moneda, tasaInteres=$tasaInteres, fechaVencimiento=$fechaVencimiento, observaciones=$observaciones, comprobanteUrl=$comprobanteUrl, cuentaBancariaId=$cuentaBancariaId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'proveedorId'] = this.proveedorId;
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
    if (this.comprobanteUrl != null) {
      json[r'comprobanteUrl'] = this.comprobanteUrl;
    } else {
      json[r'comprobanteUrl'] = null;
    }
      json[r'cuentaBancariaId'] = this.cuentaBancariaId;
    return json;
  }

  /// Returns a new [CashDebtCreateRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static CashDebtCreateRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "CashDebtCreateRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "CashDebtCreateRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return CashDebtCreateRequest(
        proveedorId: mapValueOfType<String>(json, r'proveedorId')!,
        montoCapital: num.parse('${json[r'montoCapital']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        tasaInteres: num.parse('${json[r'tasaInteres']}'),
        fechaVencimiento: mapDateTime(json, r'fechaVencimiento', r''),
        observaciones: mapValueOfType<String>(json, r'observaciones'),
        comprobanteUrl: mapValueOfType<String>(json, r'comprobanteUrl'),
        cuentaBancariaId: mapValueOfType<String>(json, r'cuentaBancariaId')!,
      );
    }
    return null;
  }

  static List<CashDebtCreateRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <CashDebtCreateRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = CashDebtCreateRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, CashDebtCreateRequest> mapFromJson(dynamic json) {
    final map = <String, CashDebtCreateRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = CashDebtCreateRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of CashDebtCreateRequest-objects as value to a dart map
  static Map<String, List<CashDebtCreateRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<CashDebtCreateRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = CashDebtCreateRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'proveedorId',
    'montoCapital',
    'cuentaBancariaId',
  };
}

