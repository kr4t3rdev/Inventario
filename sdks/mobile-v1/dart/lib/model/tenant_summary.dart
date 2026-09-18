//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class TenantSummary {
  /// Returns a new [TenantSummary] instance.
  TenantSummary({
    required this.tenantId,
    this.nombre,
    this.tenantRole,
  });

  String tenantId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? nombre;

  String? tenantRole;

  @override
  bool operator ==(Object other) => identical(this, other) || other is TenantSummary &&
    other.tenantId == tenantId &&
    other.nombre == nombre &&
    other.tenantRole == tenantRole;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantId.hashCode) +
    (nombre == null ? 0 : nombre!.hashCode) +
    (tenantRole == null ? 0 : tenantRole!.hashCode);

  @override
  String toString() => 'TenantSummary[tenantId=$tenantId, nombre=$nombre, tenantRole=$tenantRole]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantId'] = this.tenantId;
    if (this.nombre != null) {
      json[r'nombre'] = this.nombre;
    } else {
      json[r'nombre'] = null;
    }
    if (this.tenantRole != null) {
      json[r'tenantRole'] = this.tenantRole;
    } else {
      json[r'tenantRole'] = null;
    }
    return json;
  }

  /// Returns a new [TenantSummary] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static TenantSummary? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "TenantSummary[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "TenantSummary[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return TenantSummary(
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        nombre: mapValueOfType<String>(json, r'nombre'),
        tenantRole: mapValueOfType<String>(json, r'tenantRole'),
      );
    }
    return null;
  }

  static List<TenantSummary> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <TenantSummary>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = TenantSummary.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, TenantSummary> mapFromJson(dynamic json) {
    final map = <String, TenantSummary>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = TenantSummary.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of TenantSummary-objects as value to a dart map
  static Map<String, List<TenantSummary>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<TenantSummary>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = TenantSummary.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantId',
  };
}

