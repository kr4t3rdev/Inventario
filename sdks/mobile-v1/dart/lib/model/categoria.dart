//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Categoria {
  /// Returns a new [Categoria] instance.
  Categoria({
    required this.categoryId,
    required this.nombre,
    this.descripcion,
    this.createdAt,
    this.updatedAt,
  });

  /// 
  String categoryId;

  /// 
  String nombre;

  /// 
  String? descripcion;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? updatedAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Categoria &&
    other.categoryId == categoryId &&
    other.nombre == nombre &&
    other.descripcion == descripcion &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (categoryId.hashCode) +
    (nombre.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode);

  @override
  String toString() => 'Categoria[categoryId=$categoryId, nombre=$nombre, descripcion=$descripcion, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'categoryId'] = this.categoryId;
      json[r'nombre'] = this.nombre;
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    if (this.updatedAt != null) {
      json[r'updatedAt'] = this.updatedAt!.toUtc().toIso8601String();
    } else {
      json[r'updatedAt'] = null;
    }
    return json;
  }

  /// Returns a new [Categoria] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Categoria? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Categoria[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Categoria[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Categoria(
        categoryId: mapValueOfType<String>(json, r'categoryId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        descripcion: mapValueOfType<String>(json, r'descripcion'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        updatedAt: mapDateTime(json, r'updatedAt', r''),
      );
    }
    return null;
  }

  static List<Categoria> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Categoria>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Categoria.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Categoria> mapFromJson(dynamic json) {
    final map = <String, Categoria>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Categoria.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Categoria-objects as value to a dart map
  static Map<String, List<Categoria>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Categoria>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Categoria.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'categoryId',
    'nombre',
  };
}

