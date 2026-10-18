//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Merma {
  /// Returns a new [Merma] instance.
  Merma({
    required this.mermaId,
    required this.productoId,
    this.productoNombre,
    this.productoCodigo,
    required this.cantidad,
    required this.motivo,
    required this.createdAt,
    required this.updatedAt,
  });

  /// 
  String mermaId;

  /// 
  String productoId;

  /// 
  String? productoNombre;

  /// 
  String? productoCodigo;

  /// 
  num cantidad;

  /// 
  String motivo;

  /// 
  DateTime createdAt;

  /// 
  DateTime updatedAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Merma &&
    other.mermaId == mermaId &&
    other.productoId == productoId &&
    other.productoNombre == productoNombre &&
    other.productoCodigo == productoCodigo &&
    other.cantidad == cantidad &&
    other.motivo == motivo &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (mermaId.hashCode) +
    (productoId.hashCode) +
    (productoNombre == null ? 0 : productoNombre!.hashCode) +
    (productoCodigo == null ? 0 : productoCodigo!.hashCode) +
    (cantidad.hashCode) +
    (motivo.hashCode) +
    (createdAt.hashCode) +
    (updatedAt.hashCode);

  @override
  String toString() => 'Merma[mermaId=$mermaId, productoId=$productoId, productoNombre=$productoNombre, productoCodigo=$productoCodigo, cantidad=$cantidad, motivo=$motivo, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'mermaId'] = this.mermaId;
      json[r'productoId'] = this.productoId;
    if (this.productoNombre != null) {
      json[r'productoNombre'] = this.productoNombre;
    } else {
      json[r'productoNombre'] = null;
    }
    if (this.productoCodigo != null) {
      json[r'productoCodigo'] = this.productoCodigo;
    } else {
      json[r'productoCodigo'] = null;
    }
      json[r'cantidad'] = this.cantidad;
      json[r'motivo'] = this.motivo;
      json[r'createdAt'] = this.createdAt.toUtc().toIso8601String();
      json[r'updatedAt'] = this.updatedAt.toUtc().toIso8601String();
    return json;
  }

  /// Returns a new [Merma] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Merma? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Merma[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Merma[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Merma(
        mermaId: mapValueOfType<String>(json, r'mermaId')!,
        productoId: mapValueOfType<String>(json, r'productoId')!,
        productoNombre: mapValueOfType<String>(json, r'productoNombre'),
        productoCodigo: mapValueOfType<String>(json, r'productoCodigo'),
        cantidad: num.parse('${json[r'cantidad']}'),
        motivo: mapValueOfType<String>(json, r'motivo')!,
        createdAt: mapDateTime(json, r'createdAt', r'')!,
        updatedAt: mapDateTime(json, r'updatedAt', r'')!,
      );
    }
    return null;
  }

  static List<Merma> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Merma>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Merma.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Merma> mapFromJson(dynamic json) {
    final map = <String, Merma>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Merma.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Merma-objects as value to a dart map
  static Map<String, List<Merma>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Merma>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Merma.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'mermaId',
    'productoId',
    'cantidad',
    'motivo',
    'createdAt',
    'updatedAt',
  };
}

