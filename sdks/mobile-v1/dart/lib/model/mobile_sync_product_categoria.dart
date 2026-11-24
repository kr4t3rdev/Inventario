//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class MobileSyncProductCategoria {
  /// Returns a new [MobileSyncProductCategoria] instance.
  MobileSyncProductCategoria({
    required this.catId,
    required this.nombre,
  });

  String catId;

  String nombre;

  @override
  bool operator ==(Object other) => identical(this, other) || other is MobileSyncProductCategoria &&
    other.catId == catId &&
    other.nombre == nombre;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (catId.hashCode) +
    (nombre.hashCode);

  @override
  String toString() => 'MobileSyncProductCategoria[catId=$catId, nombre=$nombre]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'catId'] = this.catId;
      json[r'nombre'] = this.nombre;
    return json;
  }

  /// Returns a new [MobileSyncProductCategoria] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static MobileSyncProductCategoria? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "MobileSyncProductCategoria[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "MobileSyncProductCategoria[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return MobileSyncProductCategoria(
        catId: mapValueOfType<String>(json, r'catId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
      );
    }
    return null;
  }

  static List<MobileSyncProductCategoria> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <MobileSyncProductCategoria>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = MobileSyncProductCategoria.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, MobileSyncProductCategoria> mapFromJson(dynamic json) {
    final map = <String, MobileSyncProductCategoria>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = MobileSyncProductCategoria.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of MobileSyncProductCategoria-objects as value to a dart map
  static Map<String, List<MobileSyncProductCategoria>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<MobileSyncProductCategoria>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = MobileSyncProductCategoria.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'catId',
    'nombre',
  };
}

