//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ClienteCreateRequest {
  /// Returns a new [ClienteCreateRequest] instance.
  ClienteCreateRequest({
    required this.nombre,
    this.direccion,
    this.telefono,
    this.logoUrl,
    this.numeroCuentaCUP,
    this.numeroCuentaUSD,
    this.numeroContrato,
  });

  String nombre;

  String? direccion;

  String? telefono;

  String? logoUrl;

  String? numeroCuentaCUP;

  String? numeroCuentaUSD;

  String? numeroContrato;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ClienteCreateRequest &&
    other.nombre == nombre &&
    other.direccion == direccion &&
    other.telefono == telefono &&
    other.logoUrl == logoUrl &&
    other.numeroCuentaCUP == numeroCuentaCUP &&
    other.numeroCuentaUSD == numeroCuentaUSD &&
    other.numeroContrato == numeroContrato;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (nombre.hashCode) +
    (direccion == null ? 0 : direccion!.hashCode) +
    (telefono == null ? 0 : telefono!.hashCode) +
    (logoUrl == null ? 0 : logoUrl!.hashCode) +
    (numeroCuentaCUP == null ? 0 : numeroCuentaCUP!.hashCode) +
    (numeroCuentaUSD == null ? 0 : numeroCuentaUSD!.hashCode) +
    (numeroContrato == null ? 0 : numeroContrato!.hashCode);

  @override
  String toString() => 'ClienteCreateRequest[nombre=$nombre, direccion=$direccion, telefono=$telefono, logoUrl=$logoUrl, numeroCuentaCUP=$numeroCuentaCUP, numeroCuentaUSD=$numeroCuentaUSD, numeroContrato=$numeroContrato]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
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
    return json;
  }

  /// Returns a new [ClienteCreateRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ClienteCreateRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ClienteCreateRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ClienteCreateRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ClienteCreateRequest(
        nombre: mapValueOfType<String>(json, r'nombre')!,
        direccion: mapValueOfType<String>(json, r'direccion'),
        telefono: mapValueOfType<String>(json, r'telefono'),
        logoUrl: mapValueOfType<String>(json, r'logoUrl'),
        numeroCuentaCUP: mapValueOfType<String>(json, r'numeroCuentaCUP'),
        numeroCuentaUSD: mapValueOfType<String>(json, r'numeroCuentaUSD'),
        numeroContrato: mapValueOfType<String>(json, r'numeroContrato'),
      );
    }
    return null;
  }

  static List<ClienteCreateRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ClienteCreateRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ClienteCreateRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ClienteCreateRequest> mapFromJson(dynamic json) {
    final map = <String, ClienteCreateRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ClienteCreateRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ClienteCreateRequest-objects as value to a dart map
  static Map<String, List<ClienteCreateRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ClienteCreateRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ClienteCreateRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'nombre',
  };
}

