//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminLicenseItemTenant {
  /// Returns a new [AdminLicenseItemTenant] instance.
  AdminLicenseItemTenant({
    required this.tenantId,
    required this.nombre,
    this.memberships = const [],
  });

  String tenantId;

  String nombre;

  List<AdminLicenseManagerItem> memberships;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminLicenseItemTenant &&
    other.tenantId == tenantId &&
    other.nombre == nombre &&
    _deepEquality.equals(other.memberships, memberships);

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantId.hashCode) +
    (nombre.hashCode) +
    (memberships.hashCode);

  @override
  String toString() => 'AdminLicenseItemTenant[tenantId=$tenantId, nombre=$nombre, memberships=$memberships]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantId'] = this.tenantId;
      json[r'nombre'] = this.nombre;
      json[r'memberships'] = this.memberships;
    return json;
  }

  /// Returns a new [AdminLicenseItemTenant] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminLicenseItemTenant? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminLicenseItemTenant[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminLicenseItemTenant[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminLicenseItemTenant(
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        memberships: AdminLicenseManagerItem.listFromJson(json[r'memberships']),
      );
    }
    return null;
  }

  static List<AdminLicenseItemTenant> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminLicenseItemTenant>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminLicenseItemTenant.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminLicenseItemTenant> mapFromJson(dynamic json) {
    final map = <String, AdminLicenseItemTenant>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminLicenseItemTenant.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminLicenseItemTenant-objects as value to a dart map
  static Map<String, List<AdminLicenseItemTenant>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminLicenseItemTenant>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminLicenseItemTenant.listFromJson(entry.value, growable: growable,);
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

