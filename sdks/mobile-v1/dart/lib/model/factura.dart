//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Factura {
  /// Returns a new [Factura] instance.
  Factura({
    required this.facturaId,
    required this.numeroFactura,
    required this.tipoDocumento,
    this.ventaId,
    required this.clienteId,
    this.clienteNombre,
    required this.subtotal,
    this.impuestos,
    this.descuento,
    required this.total,
    required this.estado,
    required this.fechaEmision,
    this.fechaVencimiento,
    this.observaciones,
    this.createdAt,
    this.updatedAt,
  });

  /// ID de la factura
  String facturaId;

  /// Número de factura
  String numeroFactura;

  /// Tipo de documento
  String tipoDocumento;

  /// ID de la venta asociada
  String? ventaId;

  /// ID del cliente
  String clienteId;

  /// Nombre del cliente
  String? clienteNombre;

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

  /// Descuento
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? descuento;

  /// Total
  num total;

  /// Estado
  String estado;

  /// Fecha de emisión
  DateTime fechaEmision;

  /// Fecha de vencimiento
  String? fechaVencimiento;

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
  bool operator ==(Object other) => identical(this, other) || other is Factura &&
    other.facturaId == facturaId &&
    other.numeroFactura == numeroFactura &&
    other.tipoDocumento == tipoDocumento &&
    other.ventaId == ventaId &&
    other.clienteId == clienteId &&
    other.clienteNombre == clienteNombre &&
    other.subtotal == subtotal &&
    other.impuestos == impuestos &&
    other.descuento == descuento &&
    other.total == total &&
    other.estado == estado &&
    other.fechaEmision == fechaEmision &&
    other.fechaVencimiento == fechaVencimiento &&
    other.observaciones == observaciones &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (facturaId.hashCode) +
    (numeroFactura.hashCode) +
    (tipoDocumento.hashCode) +
    (ventaId == null ? 0 : ventaId!.hashCode) +
    (clienteId.hashCode) +
    (clienteNombre == null ? 0 : clienteNombre!.hashCode) +
    (subtotal.hashCode) +
    (impuestos == null ? 0 : impuestos!.hashCode) +
    (descuento == null ? 0 : descuento!.hashCode) +
    (total.hashCode) +
    (estado.hashCode) +
    (fechaEmision.hashCode) +
    (fechaVencimiento == null ? 0 : fechaVencimiento!.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode);

  @override
  String toString() => 'Factura[facturaId=$facturaId, numeroFactura=$numeroFactura, tipoDocumento=$tipoDocumento, ventaId=$ventaId, clienteId=$clienteId, clienteNombre=$clienteNombre, subtotal=$subtotal, impuestos=$impuestos, descuento=$descuento, total=$total, estado=$estado, fechaEmision=$fechaEmision, fechaVencimiento=$fechaVencimiento, observaciones=$observaciones, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'facturaId'] = this.facturaId;
      json[r'numeroFactura'] = this.numeroFactura;
      json[r'tipoDocumento'] = this.tipoDocumento;
    if (this.ventaId != null) {
      json[r'ventaId'] = this.ventaId;
    } else {
      json[r'ventaId'] = null;
    }
      json[r'clienteId'] = this.clienteId;
    if (this.clienteNombre != null) {
      json[r'clienteNombre'] = this.clienteNombre;
    } else {
      json[r'clienteNombre'] = null;
    }
      json[r'subtotal'] = this.subtotal;
    if (this.impuestos != null) {
      json[r'impuestos'] = this.impuestos;
    } else {
      json[r'impuestos'] = null;
    }
    if (this.descuento != null) {
      json[r'descuento'] = this.descuento;
    } else {
      json[r'descuento'] = null;
    }
      json[r'total'] = this.total;
      json[r'estado'] = this.estado;
      json[r'fechaEmision'] = this.fechaEmision.toUtc().toIso8601String();
    if (this.fechaVencimiento != null) {
      json[r'fechaVencimiento'] = this.fechaVencimiento;
    } else {
      json[r'fechaVencimiento'] = null;
    }
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

  /// Returns a new [Factura] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Factura? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Factura[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Factura[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Factura(
        facturaId: mapValueOfType<String>(json, r'facturaId')!,
        numeroFactura: mapValueOfType<String>(json, r'numeroFactura')!,
        tipoDocumento: mapValueOfType<String>(json, r'tipoDocumento')!,
        ventaId: mapValueOfType<String>(json, r'ventaId'),
        clienteId: mapValueOfType<String>(json, r'clienteId')!,
        clienteNombre: mapValueOfType<String>(json, r'clienteNombre'),
        subtotal: num.parse('${json[r'subtotal']}'),
        impuestos: num.parse('${json[r'impuestos']}'),
        descuento: num.parse('${json[r'descuento']}'),
        total: num.parse('${json[r'total']}'),
        estado: mapValueOfType<String>(json, r'estado')!,
        fechaEmision: mapDateTime(json, r'fechaEmision', r'')!,
        fechaVencimiento: mapValueOfType<String>(json, r'fechaVencimiento'),
        observaciones: mapValueOfType<String>(json, r'observaciones'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        updatedAt: mapDateTime(json, r'updatedAt', r''),
      );
    }
    return null;
  }

  static List<Factura> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Factura>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Factura.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Factura> mapFromJson(dynamic json) {
    final map = <String, Factura>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Factura.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Factura-objects as value to a dart map
  static Map<String, List<Factura>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Factura>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Factura.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'facturaId',
    'numeroFactura',
    'tipoDocumento',
    'clienteId',
    'subtotal',
    'total',
    'estado',
    'fechaEmision',
  };
}

