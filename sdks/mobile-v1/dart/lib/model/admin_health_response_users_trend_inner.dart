//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminHealthResponseUsersTrendInner {
  /// Returns a new [AdminHealthResponseUsersTrendInner] instance.
  AdminHealthResponseUsersTrendInner({
    required this.fecha,
    required this.usuarios,
  });

  DateTime fecha;

  /// Minimum value: 0
  int usuarios;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminHealthResponseUsersTrendInner &&
    other.fecha == fecha &&
    other.usuarios == usuarios;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (fecha.hashCode) +
    (usuarios.hashCode);

  @override
  String toString() => 'AdminHealthResponseUsersTrendInner[fecha=$fecha, usuarios=$usuarios]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'fecha'] = this.fecha.toUtc().toIso8601String();
      json[r'usuarios'] = this.usuarios;
    return json;
  }

  /// Returns a new [AdminHealthResponseUsersTrendInner] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminHealthResponseUsersTrendInner? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminHealthResponseUsersTrendInner[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminHealthResponseUsersTrendInner[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminHealthResponseUsersTrendInner(
        fecha: mapDateTime(json, r'fecha', r'')!,
        usuarios: mapValueOfType<int>(json, r'usuarios')!,
      );
    }
    return null;
  }

  static List<AdminHealthResponseUsersTrendInner> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminHealthResponseUsersTrendInner>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminHealthResponseUsersTrendInner.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminHealthResponseUsersTrendInner> mapFromJson(dynamic json) {
    final map = <String, AdminHealthResponseUsersTrendInner>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminHealthResponseUsersTrendInner.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminHealthResponseUsersTrendInner-objects as value to a dart map
  static Map<String, List<AdminHealthResponseUsersTrendInner>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminHealthResponseUsersTrendInner>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminHealthResponseUsersTrendInner.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'fecha',
    'usuarios',
  };
}

