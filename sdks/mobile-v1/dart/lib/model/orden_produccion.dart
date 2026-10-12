//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class OrdenProduccion {
  /// Returns a new [OrdenProduccion] instance.
  OrdenProduccion({
    required this.ordenId,
    this.recetaId,
    this.recetaNombre,
    this.productoNombre,
    required this.cantidad,
    required this.estado,
    this.fechaProduccion,
    this.costoMateriales,
    this.createdAt,
  });

  /// 
  String ordenId;

  /// 
  String? recetaId;

  /// 
  String? recetaNombre;

  /// 
  String? productoNombre;

  /// 
  int cantidad;

  /// 
  String estado;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? fechaProduccion;

  /// 
  String? costoMateriales;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is OrdenProduccion &&
    other.ordenId == ordenId &&
    other.recetaId == recetaId &&
    other.recetaNombre == recetaNombre &&
    other.productoNombre == productoNombre &&
    other.cantidad == cantidad &&
    other.estado == estado &&
    other.fechaProduccion == fechaProduccion &&
    other.costoMateriales == costoMateriales &&
    other.createdAt == createdAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ordenId.hashCode) +
    (recetaId == null ? 0 : recetaId!.hashCode) +
    (recetaNombre == null ? 0 : recetaNombre!.hashCode) +
    (productoNombre == null ? 0 : productoNombre!.hashCode) +
    (cantidad.hashCode) +
    (estado.hashCode) +
    (fechaProduccion == null ? 0 : fechaProduccion!.hashCode) +
    (costoMateriales == null ? 0 : costoMateriales!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode);

  @override
  String toString() => 'OrdenProduccion[ordenId=$ordenId, recetaId=$recetaId, recetaNombre=$recetaNombre, productoNombre=$productoNombre, cantidad=$cantidad, estado=$estado, fechaProduccion=$fechaProduccion, costoMateriales=$costoMateriales, createdAt=$createdAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'ordenId'] = this.ordenId;
    if (this.recetaId != null) {
      json[r'recetaId'] = this.recetaId;
    } else {
      json[r'recetaId'] = null;
    }
    if (this.recetaNombre != null) {
      json[r'recetaNombre'] = this.recetaNombre;
    } else {
      json[r'recetaNombre'] = null;
    }
    if (this.productoNombre != null) {
      json[r'productoNombre'] = this.productoNombre;
    } else {
      json[r'productoNombre'] = null;
    }
      json[r'cantidad'] = this.cantidad;
      json[r'estado'] = this.estado;
    if (this.fechaProduccion != null) {
      json[r'fechaProduccion'] = this.fechaProduccion!.toUtc().toIso8601String();
    } else {
      json[r'fechaProduccion'] = null;
    }
    if (this.costoMateriales != null) {
      json[r'costoMateriales'] = this.costoMateriales;
    } else {
      json[r'costoMateriales'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    return json;
  }

  /// Returns a new [OrdenProduccion] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static OrdenProduccion? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "OrdenProduccion[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "OrdenProduccion[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return OrdenProduccion(
        ordenId: mapValueOfType<String>(json, r'ordenId')!,
        recetaId: mapValueOfType<String>(json, r'recetaId'),
        recetaNombre: mapValueOfType<String>(json, r'recetaNombre'),
        productoNombre: mapValueOfType<String>(json, r'productoNombre'),
        cantidad: mapValueOfType<int>(json, r'cantidad')!,
        estado: mapValueOfType<String>(json, r'estado')!,
        fechaProduccion: mapDateTime(json, r'fechaProduccion', r''),
        costoMateriales: mapValueOfType<String>(json, r'costoMateriales'),
        createdAt: mapDateTime(json, r'createdAt', r''),
      );
    }
    return null;
  }

  static List<OrdenProduccion> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <OrdenProduccion>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = OrdenProduccion.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, OrdenProduccion> mapFromJson(dynamic json) {
    final map = <String, OrdenProduccion>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = OrdenProduccion.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of OrdenProduccion-objects as value to a dart map
  static Map<String, List<OrdenProduccion>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<OrdenProduccion>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = OrdenProduccion.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'ordenId',
    'cantidad',
    'estado',
  };
}

