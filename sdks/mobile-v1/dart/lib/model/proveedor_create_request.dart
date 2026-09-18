//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ProveedorCreateRequest {
  /// Returns a new [ProveedorCreateRequest] instance.
  ProveedorCreateRequest({
    required this.nombre,
    this.contacto,
    this.direccion,
    this.telefono,
    this.cuentaCUP,
    this.cuentaUSD,
    this.logo,
    this.contrato,
  });

  String nombre;

  String? contacto;

  String? direccion;

  String? telefono;

  String? cuentaCUP;

  String? cuentaUSD;

  String? logo;

  String? contrato;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ProveedorCreateRequest &&
    other.nombre == nombre &&
    other.contacto == contacto &&
    other.direccion == direccion &&
    other.telefono == telefono &&
    other.cuentaCUP == cuentaCUP &&
    other.cuentaUSD == cuentaUSD &&
    other.logo == logo &&
    other.contrato == contrato;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (nombre.hashCode) +
    (contacto == null ? 0 : contacto!.hashCode) +
    (direccion == null ? 0 : direccion!.hashCode) +
    (telefono == null ? 0 : telefono!.hashCode) +
    (cuentaCUP == null ? 0 : cuentaCUP!.hashCode) +
    (cuentaUSD == null ? 0 : cuentaUSD!.hashCode) +
    (logo == null ? 0 : logo!.hashCode) +
    (contrato == null ? 0 : contrato!.hashCode);

  @override
  String toString() => 'ProveedorCreateRequest[nombre=$nombre, contacto=$contacto, direccion=$direccion, telefono=$telefono, cuentaCUP=$cuentaCUP, cuentaUSD=$cuentaUSD, logo=$logo, contrato=$contrato]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'nombre'] = this.nombre;
    if (this.contacto != null) {
      json[r'contacto'] = this.contacto;
    } else {
      json[r'contacto'] = null;
    }
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
    if (this.cuentaCUP != null) {
      json[r'cuentaCUP'] = this.cuentaCUP;
    } else {
      json[r'cuentaCUP'] = null;
    }
    if (this.cuentaUSD != null) {
      json[r'cuentaUSD'] = this.cuentaUSD;
    } else {
      json[r'cuentaUSD'] = null;
    }
    if (this.logo != null) {
      json[r'logo'] = this.logo;
    } else {
      json[r'logo'] = null;
    }
    if (this.contrato != null) {
      json[r'contrato'] = this.contrato;
    } else {
      json[r'contrato'] = null;
    }
    return json;
  }

  /// Returns a new [ProveedorCreateRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ProveedorCreateRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ProveedorCreateRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ProveedorCreateRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ProveedorCreateRequest(
        nombre: mapValueOfType<String>(json, r'nombre')!,
        contacto: mapValueOfType<String>(json, r'contacto'),
        direccion: mapValueOfType<String>(json, r'direccion'),
        telefono: mapValueOfType<String>(json, r'telefono'),
        cuentaCUP: mapValueOfType<String>(json, r'cuentaCUP'),
        cuentaUSD: mapValueOfType<String>(json, r'cuentaUSD'),
        logo: mapValueOfType<String>(json, r'logo'),
        contrato: mapValueOfType<String>(json, r'contrato'),
      );
    }
    return null;
  }

  static List<ProveedorCreateRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ProveedorCreateRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ProveedorCreateRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ProveedorCreateRequest> mapFromJson(dynamic json) {
    final map = <String, ProveedorCreateRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ProveedorCreateRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ProveedorCreateRequest-objects as value to a dart map
  static Map<String, List<ProveedorCreateRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ProveedorCreateRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ProveedorCreateRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'nombre',
  };
}

