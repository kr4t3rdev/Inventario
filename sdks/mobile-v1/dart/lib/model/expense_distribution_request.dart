//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ExpenseDistributionRequest {
  /// Returns a new [ExpenseDistributionRequest] instance.
  ExpenseDistributionRequest({
    required this.cuentaId,
    required this.monto,
    this.porcentaje,
  });

  String cuentaId;

  num monto;

  /// Minimum value: 0
  /// Maximum value: 100
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? porcentaje;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ExpenseDistributionRequest &&
    other.cuentaId == cuentaId &&
    other.monto == monto &&
    other.porcentaje == porcentaje;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (cuentaId.hashCode) +
    (monto.hashCode) +
    (porcentaje == null ? 0 : porcentaje!.hashCode);

  @override
  String toString() => 'ExpenseDistributionRequest[cuentaId=$cuentaId, monto=$monto, porcentaje=$porcentaje]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'cuentaId'] = this.cuentaId;
      json[r'monto'] = this.monto;
    if (this.porcentaje != null) {
      json[r'porcentaje'] = this.porcentaje;
    } else {
      json[r'porcentaje'] = null;
    }
    return json;
  }

  /// Returns a new [ExpenseDistributionRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ExpenseDistributionRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ExpenseDistributionRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ExpenseDistributionRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ExpenseDistributionRequest(
        cuentaId: mapValueOfType<String>(json, r'cuentaId')!,
        monto: num.parse('${json[r'monto']}'),
        porcentaje: num.parse('${json[r'porcentaje']}'),
      );
    }
    return null;
  }

  static List<ExpenseDistributionRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ExpenseDistributionRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ExpenseDistributionRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ExpenseDistributionRequest> mapFromJson(dynamic json) {
    final map = <String, ExpenseDistributionRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ExpenseDistributionRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ExpenseDistributionRequest-objects as value to a dart map
  static Map<String, List<ExpenseDistributionRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ExpenseDistributionRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ExpenseDistributionRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'cuentaId',
    'monto',
  };
}

