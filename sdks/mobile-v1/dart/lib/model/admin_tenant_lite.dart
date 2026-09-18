//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminTenantLite {
  /// Returns a new [AdminTenantLite] instance.
  AdminTenantLite({
    required this.tenantId,
    required this.nombre,
  });

  String tenantId;

  String nombre;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminTenantLite &&
    other.tenantId == tenantId &&
    other.nombre == nombre;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantId.hashCode) +
    (nombre.hashCode);

  @override
  String toString() => 'AdminTenantLite[tenantId=$tenantId, nombre=$nombre]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantId'] = this.tenantId;
      json[r'nombre'] = this.nombre;
    return json;
  }

  /// Returns a new [AdminTenantLite] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminTenantLite? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminTenantLite[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminTenantLite[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminTenantLite(
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
      );
    }
    return null;
  }

  static List<AdminTenantLite> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminTenantLite>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminTenantLite.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminTenantLite> mapFromJson(dynamic json) {
    final map = <String, AdminTenantLite>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminTenantLite.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminTenantLite-objects as value to a dart map
  static Map<String, List<AdminTenantLite>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminTenantLite>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminTenantLite.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantId',
    'nombre',
  };
}

