//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class SaleReconciliationRequest {
  /// Returns a new [SaleReconciliationRequest] instance.
  SaleReconciliationRequest({
    required this.ventaId,
    required this.cuentaId,
    required this.tipoPagoId,
    required this.monto,
    this.moneda,
    this.fechaReconciliacion,
    this.observaciones,
  });

  String ventaId;

  String cuentaId;

  String tipoPagoId;

  num monto;

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
  DateTime? fechaReconciliacion;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? observaciones;

  @override
  bool operator ==(Object other) => identical(this, other) || other is SaleReconciliationRequest &&
    other.ventaId == ventaId &&
    other.cuentaId == cuentaId &&
    other.tipoPagoId == tipoPagoId &&
    other.monto == monto &&
    other.moneda == moneda &&
    other.fechaReconciliacion == fechaReconciliacion &&
    other.observaciones == observaciones;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ventaId.hashCode) +
    (cuentaId.hashCode) +
    (tipoPagoId.hashCode) +
    (monto.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (fechaReconciliacion == null ? 0 : fechaReconciliacion!.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode);

  @override
  String toString() => 'SaleReconciliationRequest[ventaId=$ventaId, cuentaId=$cuentaId, tipoPagoId=$tipoPagoId, monto=$monto, moneda=$moneda, fechaReconciliacion=$fechaReconciliacion, observaciones=$observaciones]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'ventaId'] = this.ventaId;
      json[r'cuentaId'] = this.cuentaId;
      json[r'tipoPagoId'] = this.tipoPagoId;
      json[r'monto'] = this.monto;
    if (this.moneda != null) {
      json[r'moneda'] = this.moneda;
    } else {
      json[r'moneda'] = null;
    }
    if (this.fechaReconciliacion != null) {
      json[r'fechaReconciliacion'] = this.fechaReconciliacion!.toUtc().toIso8601String();
    } else {
      json[r'fechaReconciliacion'] = null;
    }
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
    return json;
  }

  /// Returns a new [SaleReconciliationRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static SaleReconciliationRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "SaleReconciliationRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "SaleReconciliationRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return SaleReconciliationRequest(
        ventaId: mapValueOfType<String>(json, r'ventaId')!,
        cuentaId: mapValueOfType<String>(json, r'cuentaId')!,
        tipoPagoId: mapValueOfType<String>(json, r'tipoPagoId')!,
        monto: num.parse('${json[r'monto']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        fechaReconciliacion: mapDateTime(json, r'fechaReconciliacion', r''),
        observaciones: mapValueOfType<String>(json, r'observaciones'),
      );
    }
    return null;
  }

  static List<SaleReconciliationRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <SaleReconciliationRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = SaleReconciliationRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, SaleReconciliationRequest> mapFromJson(dynamic json) {
    final map = <String, SaleReconciliationRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = SaleReconciliationRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of SaleReconciliationRequest-objects as value to a dart map
  static Map<String, List<SaleReconciliationRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<SaleReconciliationRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = SaleReconciliationRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'ventaId',
    'cuentaId',
    'tipoPagoId',
    'monto',
  };
}

