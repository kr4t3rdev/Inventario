//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Cliente {
  /// Returns a new [Cliente] instance.
  Cliente({
    required this.clienteId,
    required this.nombre,
    this.direccion,
    this.telefono,
    this.logoUrl,
    this.numeroCuentaCUP,
    this.numeroCuentaUSD,
    this.numeroContrato,
    this.createdAt,
    this.updatedAt,
  });

  String clienteId;

  String nombre;

  String? direccion;

  String? telefono;

  String? logoUrl;

  String? numeroCuentaCUP;

  String? numeroCuentaUSD;

  String? numeroContrato;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? updatedAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Cliente &&
    other.clienteId == clienteId &&
    other.nombre == nombre &&
    other.direccion == direccion &&
    other.telefono == telefono &&
    other.logoUrl == logoUrl &&
    other.numeroCuentaCUP == numeroCuentaCUP &&
    other.numeroCuentaUSD == numeroCuentaUSD &&
    other.numeroContrato == numeroContrato &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (clienteId.hashCode) +
    (nombre.hashCode) +
    (direccion == null ? 0 : direccion!.hashCode) +
    (telefono == null ? 0 : telefono!.hashCode) +
    (logoUrl == null ? 0 : logoUrl!.hashCode) +
    (numeroCuentaCUP == null ? 0 : numeroCuentaCUP!.hashCode) +
    (numeroCuentaUSD == null ? 0 : numeroCuentaUSD!.hashCode) +
    (numeroContrato == null ? 0 : numeroContrato!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode);

  @override
  String toString() => 'Cliente[clienteId=$clienteId, nombre=$nombre, direccion=$direccion, telefono=$telefono, logoUrl=$logoUrl, numeroCuentaCUP=$numeroCuentaCUP, numeroCuentaUSD=$numeroCuentaUSD, numeroContrato=$numeroContrato, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'clienteId'] = this.clienteId;
      json[r'nombre'] = this.nombre;
    if (this.direccion != null) {
      json[r'direccion'] = this.direccion;
    } else {
      json[r'direccion'] = null;
    }
    if (this.telefono != null) {
      json[r'telefono'] = this.telefono;
    } else {
      json[r'telefono'] = null;
    }
    if (this.logoUrl != null) {
      json[r'logoUrl'] = this.logoUrl;
    } else {
      json[r'logoUrl'] = null;
    }
    if (this.numeroCuentaCUP != null) {
      json[r'numeroCuentaCUP'] = this.numeroCuentaCUP;
    } else {
      json[r'numeroCuentaCUP'] = null;
    }
    if (this.numeroCuentaUSD != null) {
      json[r'numeroCuentaUSD'] = this.numeroCuentaUSD;
    } else {
      json[r'numeroCuentaUSD'] = null;
    }
    if (this.numeroContrato != null) {
      json[r'numeroContrato'] = this.numeroContrato;
    } else {
      json[r'numeroContrato'] = null;
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

  /// Returns a new [Cliente] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Cliente? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Cliente[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Cliente[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Cliente(
        clienteId: mapValueOfType<String>(json, r'clienteId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        direccion: mapValueOfType<String>(json, r'direccion'),
        telefono: mapValueOfType<String>(json, r'telefono'),
        logoUrl: mapValueOfType<String>(json, r'logoUrl'),
        numeroCuentaCUP: mapValueOfType<String>(json, r'numeroCuentaCUP'),
        numeroCuentaUSD: mapValueOfType<String>(json, r'numeroCuentaUSD'),
        numeroContrato: mapValueOfType<String>(json, r'numeroContrato'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        updatedAt: mapDateTime(json, r'updatedAt', r''),
      );
    }
    return null;
  }

  static List<Cliente> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Cliente>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Cliente.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Cliente> mapFromJson(dynamic json) {
    final map = <String, Cliente>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Cliente.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Cliente-objects as value to a dart map
  static Map<String, List<Cliente>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Cliente>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Cliente.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'clienteId',
    'nombre',
  };
}

