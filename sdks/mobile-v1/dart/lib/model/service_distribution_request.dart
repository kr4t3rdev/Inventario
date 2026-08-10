//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ServiceDistributionRequest {
  /// Returns a new [ServiceDistributionRequest] instance.
  ServiceDistributionRequest({
    required this.cuentaId,
    required this.tipoPagoId,
    required this.monto,
    this.moneda,
    this.observaciones,
  });

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
  String? observaciones;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ServiceDistributionRequest &&
    other.cuentaId == cuentaId &&
    other.tipoPagoId == tipoPagoId &&
    other.monto == monto &&
    other.moneda == moneda &&
    other.observaciones == observaciones;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (cuentaId.hashCode) +
    (tipoPagoId.hashCode) +
    (monto.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode);

  @override
  String toString() => 'ServiceDistributionRequest[cuentaId=$cuentaId, tipoPagoId=$tipoPagoId, monto=$monto, moneda=$moneda, observaciones=$observaciones]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'cuentaId'] = this.cuentaId;
      json[r'tipoPagoId'] = this.tipoPagoId;
      json[r'monto'] = this.monto;
    if (this.moneda != null) {
      json[r'moneda'] = this.moneda;
    } else {
      json[r'moneda'] = null;
    }
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
    return json;
  }

  /// Returns a new [ServiceDistributionRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ServiceDistributionRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ServiceDistributionRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ServiceDistributionRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ServiceDistributionRequest(
        cuentaId: mapValueOfType<String>(json, r'cuentaId')!,
        tipoPagoId: mapValueOfType<String>(json, r'tipoPagoId')!,
        monto: num.parse('${json[r'monto']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        observaciones: mapValueOfType<String>(json, r'observaciones'),
      );
    }
    return null;
  }

  static List<ServiceDistributionRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ServiceDistributionRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ServiceDistributionRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ServiceDistributionRequest> mapFromJson(dynamic json) {
    final map = <String, ServiceDistributionRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ServiceDistributionRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ServiceDistributionRequest-objects as value to a dart map
  static Map<String, List<ServiceDistributionRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ServiceDistributionRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ServiceDistributionRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'cuentaId',
    'tipoPagoId',
    'monto',
  };
}

