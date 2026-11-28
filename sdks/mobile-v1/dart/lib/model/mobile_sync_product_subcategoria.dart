//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class MobileSyncProductSubcategoria {
  /// Returns a new [MobileSyncProductSubcategoria] instance.
  MobileSyncProductSubcategoria({
    required this.catId,
    required this.nombre,
    required this.parentId,
  });

  String catId;

  String nombre;

  String? parentId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is MobileSyncProductSubcategoria &&
    other.catId == catId &&
    other.nombre == nombre &&
    other.parentId == parentId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (catId.hashCode) +
    (nombre.hashCode) +
    (parentId == null ? 0 : parentId!.hashCode);

  @override
  String toString() => 'MobileSyncProductSubcategoria[catId=$catId, nombre=$nombre, parentId=$parentId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'catId'] = this.catId;
      json[r'nombre'] = this.nombre;
    if (this.parentId != null) {
      json[r'parentId'] = this.parentId;
    } else {
      json[r'parentId'] = null;
    }
    return json;
  }

  /// Returns a new [MobileSyncProductSubcategoria] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static MobileSyncProductSubcategoria? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "MobileSyncProductSubcategoria[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "MobileSyncProductSubcategoria[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return MobileSyncProductSubcategoria(
        catId: mapValueOfType<String>(json, r'catId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        parentId: mapValueOfType<String>(json, r'parentId'),
      );
    }
    return null;
  }

  static List<MobileSyncProductSubcategoria> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <MobileSyncProductSubcategoria>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = MobileSyncProductSubcategoria.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, MobileSyncProductSubcategoria> mapFromJson(dynamic json) {
    final map = <String, MobileSyncProductSubcategoria>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = MobileSyncProductSubcategoria.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of MobileSyncProductSubcategoria-objects as value to a dart map
  static Map<String, List<MobileSyncProductSubcategoria>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<MobileSyncProductSubcategoria>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = MobileSyncProductSubcategoria.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'catId',
    'nombre',
    'parentId',
  };
}

