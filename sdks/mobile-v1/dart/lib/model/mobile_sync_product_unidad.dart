//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class MobileSyncProductUnidad {
  /// Returns a new [MobileSyncProductUnidad] instance.
  MobileSyncProductUnidad({
    required this.unidadId,
    required this.nombre,
    required this.simbolo,
  });

  String unidadId;

  String nombre;

  String simbolo;

  @override
  bool operator ==(Object other) => identical(this, other) || other is MobileSyncProductUnidad &&
    other.unidadId == unidadId &&
    other.nombre == nombre &&
    other.simbolo == simbolo;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (unidadId.hashCode) +
    (nombre.hashCode) +
    (simbolo.hashCode);

  @override
  String toString() => 'MobileSyncProductUnidad[unidadId=$unidadId, nombre=$nombre, simbolo=$simbolo]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'unidadId'] = this.unidadId;
      json[r'nombre'] = this.nombre;
      json[r'simbolo'] = this.simbolo;
    return json;
  }

  /// Returns a new [MobileSyncProductUnidad] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static MobileSyncProductUnidad? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "MobileSyncProductUnidad[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "MobileSyncProductUnidad[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return MobileSyncProductUnidad(
        unidadId: mapValueOfType<String>(json, r'unidadId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        simbolo: mapValueOfType<String>(json, r'simbolo')!,
      );
    }
    return null;
  }

  static List<MobileSyncProductUnidad> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <MobileSyncProductUnidad>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = MobileSyncProductUnidad.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, MobileSyncProductUnidad> mapFromJson(dynamic json) {
    final map = <String, MobileSyncProductUnidad>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = MobileSyncProductUnidad.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of MobileSyncProductUnidad-objects as value to a dart map
  static Map<String, List<MobileSyncProductUnidad>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<MobileSyncProductUnidad>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = MobileSyncProductUnidad.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'unidadId',
    'nombre',
    'simbolo',
  };
}

