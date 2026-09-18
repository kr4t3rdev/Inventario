//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Proveedor {
  /// Returns a new [Proveedor] instance.
  Proveedor({
    required this.vendorId,
    required this.nombre,
    this.contacto,
    this.direccion,
    this.telefono,
    this.cuentaCUP,
    this.cuentaUSD,
    this.logo,
    this.contrato,
    this.vendorCode,
    this.createdAt,
    this.updatedAt,
  });

  String vendorId;

  String nombre;

  String? contacto;

  String? direccion;

  String? telefono;

  String? cuentaCUP;

  String? cuentaUSD;

  String? logo;

  String? contrato;

  String? vendorCode;

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
  bool operator ==(Object other) => identical(this, other) || other is Proveedor &&
    other.vendorId == vendorId &&
    other.nombre == nombre &&
    other.contacto == contacto &&
    other.direccion == direccion &&
    other.telefono == telefono &&
    other.cuentaCUP == cuentaCUP &&
    other.cuentaUSD == cuentaUSD &&
    other.logo == logo &&
    other.contrato == contrato &&
    other.vendorCode == vendorCode &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (vendorId.hashCode) +
    (nombre.hashCode) +
    (contacto == null ? 0 : contacto!.hashCode) +
    (direccion == null ? 0 : direccion!.hashCode) +
    (telefono == null ? 0 : telefono!.hashCode) +
    (cuentaCUP == null ? 0 : cuentaCUP!.hashCode) +
    (cuentaUSD == null ? 0 : cuentaUSD!.hashCode) +
    (logo == null ? 0 : logo!.hashCode) +
    (contrato == null ? 0 : contrato!.hashCode) +
    (vendorCode == null ? 0 : vendorCode!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode);

  @override
  String toString() => 'Proveedor[vendorId=$vendorId, nombre=$nombre, contacto=$contacto, direccion=$direccion, telefono=$telefono, cuentaCUP=$cuentaCUP, cuentaUSD=$cuentaUSD, logo=$logo, contrato=$contrato, vendorCode=$vendorCode, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'vendorId'] = this.vendorId;
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
    if (this.vendorCode != null) {
      json[r'vendorCode'] = this.vendorCode;
    } else {
      json[r'vendorCode'] = null;
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

  /// Returns a new [Proveedor] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Proveedor? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Proveedor[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Proveedor[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Proveedor(
        vendorId: mapValueOfType<String>(json, r'vendorId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        contacto: mapValueOfType<String>(json, r'contacto'),
        direccion: mapValueOfType<String>(json, r'direccion'),
        telefono: mapValueOfType<String>(json, r'telefono'),
        cuentaCUP: mapValueOfType<String>(json, r'cuentaCUP'),
        cuentaUSD: mapValueOfType<String>(json, r'cuentaUSD'),
        logo: mapValueOfType<String>(json, r'logo'),
        contrato: mapValueOfType<String>(json, r'contrato'),
        vendorCode: mapValueOfType<String>(json, r'vendorCode'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        updatedAt: mapDateTime(json, r'updatedAt', r''),
      );
    }
    return null;
  }

  static List<Proveedor> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Proveedor>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Proveedor.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Proveedor> mapFromJson(dynamic json) {
    final map = <String, Proveedor>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Proveedor.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Proveedor-objects as value to a dart map
  static Map<String, List<Proveedor>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Proveedor>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Proveedor.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'vendorId',
    'nombre',
  };
}

