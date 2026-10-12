//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Oferta {
  /// Returns a new [Oferta] instance.
  Oferta({
    required this.ofertaId,
    required this.numeroOferta,
    required this.clienteId,
    this.clienteNombre,
    required this.fechaEmision,
    this.fechaVencimiento,
    required this.estado,
    required this.subtotal,
    this.impuestos,
    required this.total,
    this.observaciones,
    this.createdAt,
    this.updatedAt,
  });

  /// ID de la oferta
  String ofertaId;

  /// Número de oferta
  String numeroOferta;

  /// ID del cliente
  String clienteId;

  /// Nombre del cliente
  String? clienteNombre;

  /// Fecha de emisión
  DateTime fechaEmision;

  /// Fecha de vencimiento
  String? fechaVencimiento;

  /// Estado
  String estado;

  /// Subtotal
  num subtotal;

  /// Impuestos
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? impuestos;

  /// Total
  num total;

  /// Observaciones
  String? observaciones;

  /// Creación
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  /// Actualización
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? updatedAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Oferta &&
    other.ofertaId == ofertaId &&
    other.numeroOferta == numeroOferta &&
    other.clienteId == clienteId &&
    other.clienteNombre == clienteNombre &&
    other.fechaEmision == fechaEmision &&
    other.fechaVencimiento == fechaVencimiento &&
    other.estado == estado &&
    other.subtotal == subtotal &&
    other.impuestos == impuestos &&
    other.total == total &&
    other.observaciones == observaciones &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ofertaId.hashCode) +
    (numeroOferta.hashCode) +
    (clienteId.hashCode) +
    (clienteNombre == null ? 0 : clienteNombre!.hashCode) +
    (fechaEmision.hashCode) +
    (fechaVencimiento == null ? 0 : fechaVencimiento!.hashCode) +
    (estado.hashCode) +
    (subtotal.hashCode) +
    (impuestos == null ? 0 : impuestos!.hashCode) +
    (total.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode);

  @override
  String toString() => 'Oferta[ofertaId=$ofertaId, numeroOferta=$numeroOferta, clienteId=$clienteId, clienteNombre=$clienteNombre, fechaEmision=$fechaEmision, fechaVencimiento=$fechaVencimiento, estado=$estado, subtotal=$subtotal, impuestos=$impuestos, total=$total, observaciones=$observaciones, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'ofertaId'] = this.ofertaId;
      json[r'numeroOferta'] = this.numeroOferta;
      json[r'clienteId'] = this.clienteId;
    if (this.clienteNombre != null) {
      json[r'clienteNombre'] = this.clienteNombre;
    } else {
      json[r'clienteNombre'] = null;
    }
      json[r'fechaEmision'] = this.fechaEmision.toUtc().toIso8601String();
    if (this.fechaVencimiento != null) {
      json[r'fechaVencimiento'] = this.fechaVencimiento;
    } else {
      json[r'fechaVencimiento'] = null;
    }
      json[r'estado'] = this.estado;
      json[r'subtotal'] = this.subtotal;
    if (this.impuestos != null) {
      json[r'impuestos'] = this.impuestos;
    } else {
      json[r'impuestos'] = null;
    }
      json[r'total'] = this.total;
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
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

  /// Returns a new [Oferta] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Oferta? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Oferta[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Oferta[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Oferta(
        ofertaId: mapValueOfType<String>(json, r'ofertaId')!,
        numeroOferta: mapValueOfType<String>(json, r'numeroOferta')!,
        clienteId: mapValueOfType<String>(json, r'clienteId')!,
        clienteNombre: mapValueOfType<String>(json, r'clienteNombre'),
        fechaEmision: mapDateTime(json, r'fechaEmision', r'')!,
        fechaVencimiento: mapValueOfType<String>(json, r'fechaVencimiento'),
        estado: mapValueOfType<String>(json, r'estado')!,
        subtotal: num.parse('${json[r'subtotal']}'),
        impuestos: num.parse('${json[r'impuestos']}'),
        total: num.parse('${json[r'total']}'),
        observaciones: mapValueOfType<String>(json, r'observaciones'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        updatedAt: mapDateTime(json, r'updatedAt', r''),
      );
    }
    return null;
  }

  static List<Oferta> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Oferta>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Oferta.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Oferta> mapFromJson(dynamic json) {
    final map = <String, Oferta>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Oferta.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Oferta-objects as value to a dart map
  static Map<String, List<Oferta>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Oferta>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Oferta.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'ofertaId',
    'numeroOferta',
    'clienteId',
    'fechaEmision',
    'estado',
    'subtotal',
    'total',
  };
}

