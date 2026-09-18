//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminTenantItemCount {
  /// Returns a new [AdminTenantItemCount] instance.
  AdminTenantItemCount({
    required this.memberships,
    required this.productos,
    required this.almacenes,
  });

  /// Minimum value: 0
  int memberships;

  /// Minimum value: 0
  int productos;

  /// Minimum value: 0
  int almacenes;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminTenantItemCount &&
    other.memberships == memberships &&
    other.productos == productos &&
    other.almacenes == almacenes;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (memberships.hashCode) +
    (productos.hashCode) +
    (almacenes.hashCode);

  @override
  String toString() => 'AdminTenantItemCount[memberships=$memberships, productos=$productos, almacenes=$almacenes]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'memberships'] = this.memberships;
      json[r'productos'] = this.productos;
      json[r'almacenes'] = this.almacenes;
    return json;
  }

  /// Returns a new [AdminTenantItemCount] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminTenantItemCount? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminTenantItemCount[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminTenantItemCount[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminTenantItemCount(
        memberships: mapValueOfType<int>(json, r'memberships')!,
        productos: mapValueOfType<int>(json, r'productos')!,
        almacenes: mapValueOfType<int>(json, r'almacenes')!,
      );
    }
    return null;
  }

  static List<AdminTenantItemCount> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminTenantItemCount>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminTenantItemCount.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminTenantItemCount> mapFromJson(dynamic json) {
    final map = <String, AdminTenantItemCount>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminTenantItemCount.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminTenantItemCount-objects as value to a dart map
  static Map<String, List<AdminTenantItemCount>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminTenantItemCount>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminTenantItemCount.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'memberships',
    'productos',
    'almacenes',
  };
}

