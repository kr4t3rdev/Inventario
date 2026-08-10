//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class CapitalPaymentRequest {
  /// Returns a new [CapitalPaymentRequest] instance.
  CapitalPaymentRequest({
    required this.monto,
    required this.cuentaBancariaId,
    required this.tipoPagoId,
    this.observaciones,
  });

  num monto;

  String cuentaBancariaId;

  String tipoPagoId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? observaciones;

  @override
  bool operator ==(Object other) => identical(this, other) || other is CapitalPaymentRequest &&
    other.monto == monto &&
    other.cuentaBancariaId == cuentaBancariaId &&
    other.tipoPagoId == tipoPagoId &&
    other.observaciones == observaciones;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (monto.hashCode) +
    (cuentaBancariaId.hashCode) +
    (tipoPagoId.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode);

  @override
  String toString() => 'CapitalPaymentRequest[monto=$monto, cuentaBancariaId=$cuentaBancariaId, tipoPagoId=$tipoPagoId, observaciones=$observaciones]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'monto'] = this.monto;
      json[r'cuentaBancariaId'] = this.cuentaBancariaId;
      json[r'tipoPagoId'] = this.tipoPagoId;
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
    return json;
  }

  /// Returns a new [CapitalPaymentRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static CapitalPaymentRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "CapitalPaymentRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "CapitalPaymentRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return CapitalPaymentRequest(
        monto: num.parse('${json[r'monto']}'),
        cuentaBancariaId: mapValueOfType<String>(json, r'cuentaBancariaId')!,
        tipoPagoId: mapValueOfType<String>(json, r'tipoPagoId')!,
        observaciones: mapValueOfType<String>(json, r'observaciones'),
      );
    }
    return null;
  }

  static List<CapitalPaymentRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <CapitalPaymentRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = CapitalPaymentRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, CapitalPaymentRequest> mapFromJson(dynamic json) {
    final map = <String, CapitalPaymentRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = CapitalPaymentRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of CapitalPaymentRequest-objects as value to a dart map
  static Map<String, List<CapitalPaymentRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<CapitalPaymentRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = CapitalPaymentRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'monto',
    'cuentaBancariaId',
    'tipoPagoId',
  };
}

