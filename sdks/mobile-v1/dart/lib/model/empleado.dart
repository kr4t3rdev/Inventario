//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Empleado {
  /// Returns a new [Empleado] instance.
  Empleado({
    required this.empleadoId,
    required this.nombre,
    required this.apellido,
    this.telefono,
    required this.cargo,
    this.salarioBases,
    this.fechaContratacion,
    this.esTiempoCompleto,
    this.createdAt,
  });

  /// 
  String empleadoId;

  /// 
  String nombre;

  /// 
  String apellido;

  /// 
  String? telefono;

  /// 
  String cargo;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? salarioBases;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? fechaContratacion;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? esTiempoCompleto;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Empleado &&
    other.empleadoId == empleadoId &&
    other.nombre == nombre &&
    other.apellido == apellido &&
    other.telefono == telefono &&
    other.cargo == cargo &&
    other.salarioBases == salarioBases &&
    other.fechaContratacion == fechaContratacion &&
    other.esTiempoCompleto == esTiempoCompleto &&
    other.createdAt == createdAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (empleadoId.hashCode) +
    (nombre.hashCode) +
    (apellido.hashCode) +
    (telefono == null ? 0 : telefono!.hashCode) +
    (cargo.hashCode) +
    (salarioBases == null ? 0 : salarioBases!.hashCode) +
    (fechaContratacion == null ? 0 : fechaContratacion!.hashCode) +
    (esTiempoCompleto == null ? 0 : esTiempoCompleto!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode);

  @override
  String toString() => 'Empleado[empleadoId=$empleadoId, nombre=$nombre, apellido=$apellido, telefono=$telefono, cargo=$cargo, salarioBases=$salarioBases, fechaContratacion=$fechaContratacion, esTiempoCompleto=$esTiempoCompleto, createdAt=$createdAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'empleadoId'] = this.empleadoId;
      json[r'nombre'] = this.nombre;
      json[r'apellido'] = this.apellido;
    if (this.telefono != null) {
      json[r'telefono'] = this.telefono;
    } else {
      json[r'telefono'] = null;
    }
      json[r'cargo'] = this.cargo;
    if (this.salarioBases != null) {
      json[r'salarioBases'] = this.salarioBases;
    } else {
      json[r'salarioBases'] = null;
    }
    if (this.fechaContratacion != null) {
      json[r'fechaContratacion'] = this.fechaContratacion!.toUtc().toIso8601String();
    } else {
      json[r'fechaContratacion'] = null;
    }
    if (this.esTiempoCompleto != null) {
      json[r'esTiempoCompleto'] = this.esTiempoCompleto;
    } else {
      json[r'esTiempoCompleto'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    return json;
  }

  /// Returns a new [Empleado] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Empleado? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Empleado[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Empleado[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Empleado(
        empleadoId: mapValueOfType<String>(json, r'empleadoId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        apellido: mapValueOfType<String>(json, r'apellido')!,
        telefono: mapValueOfType<String>(json, r'telefono'),
        cargo: mapValueOfType<String>(json, r'cargo')!,
        salarioBases: mapValueOfType<int>(json, r'salarioBases'),
        fechaContratacion: mapDateTime(json, r'fechaContratacion', r''),
        esTiempoCompleto: mapValueOfType<bool>(json, r'esTiempoCompleto'),
        createdAt: mapDateTime(json, r'createdAt', r''),
      );
    }
    return null;
  }

  static List<Empleado> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Empleado>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Empleado.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Empleado> mapFromJson(dynamic json) {
    final map = <String, Empleado>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Empleado.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Empleado-objects as value to a dart map
  static Map<String, List<Empleado>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Empleado>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Empleado.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'empleadoId',
    'nombre',
    'apellido',
    'cargo',
  };
}

