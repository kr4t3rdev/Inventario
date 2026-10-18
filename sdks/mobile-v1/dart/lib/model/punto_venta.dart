//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PuntoVenta {
  /// Returns a new [PuntoVenta] instance.
  PuntoVenta({
    required this.pvId,
    required this.nombre,
    this.ubicacion,
    this.tipoCaja,
    this.listaPrecioNombre,
    this.createdAt,
  });

  /// 
  String pvId;

  /// 
  String nombre;

  /// 
  String? ubicacion;

  /// 
  String? tipoCaja;

  /// 
  String? listaPrecioNombre;

  /// 
  String? createdAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PuntoVenta &&
    other.pvId == pvId &&
    other.nombre == nombre &&
    other.ubicacion == ubicacion &&
    other.tipoCaja == tipoCaja &&
    other.listaPrecioNombre == listaPrecioNombre &&
    other.createdAt == createdAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (pvId.hashCode) +
    (nombre.hashCode) +
    (ubicacion == null ? 0 : ubicacion!.hashCode) +
    (tipoCaja == null ? 0 : tipoCaja!.hashCode) +
    (listaPrecioNombre == null ? 0 : listaPrecioNombre!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode);

  @override
  String toString() => 'PuntoVenta[pvId=$pvId, nombre=$nombre, ubicacion=$ubicacion, tipoCaja=$tipoCaja, listaPrecioNombre=$listaPrecioNombre, createdAt=$createdAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'pvId'] = this.pvId;
      json[r'nombre'] = this.nombre;
    if (this.ubicacion != null) {
      json[r'ubicacion'] = this.ubicacion;
    } else {
      json[r'ubicacion'] = null;
    }
    if (this.tipoCaja != null) {
      json[r'tipoCaja'] = this.tipoCaja;
    } else {
      json[r'tipoCaja'] = null;
    }
    if (this.listaPrecioNombre != null) {
      json[r'listaPrecioNombre'] = this.listaPrecioNombre;
    } else {
      json[r'listaPrecioNombre'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt;
    } else {
      json[r'createdAt'] = null;
    }
    return json;
  }

  /// Returns a new [PuntoVenta] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PuntoVenta? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PuntoVenta[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PuntoVenta[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PuntoVenta(
        pvId: mapValueOfType<String>(json, r'pvId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        ubicacion: mapValueOfType<String>(json, r'ubicacion'),
        tipoCaja: mapValueOfType<String>(json, r'tipoCaja'),
        listaPrecioNombre: mapValueOfType<String>(json, r'listaPrecioNombre'),
        createdAt: mapValueOfType<String>(json, r'createdAt'),
      );
    }
    return null;
  }

  static List<PuntoVenta> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PuntoVenta>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PuntoVenta.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PuntoVenta> mapFromJson(dynamic json) {
    final map = <String, PuntoVenta>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PuntoVenta.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PuntoVenta-objects as value to a dart map
  static Map<String, List<PuntoVenta>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PuntoVenta>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PuntoVenta.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'pvId',
    'nombre',
  };
}

