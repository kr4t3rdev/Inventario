//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Compra {
  /// Returns a new [Compra] instance.
  Compra({
    required this.compraId,
    this.numeroFactura,
    required this.proveedorId,
    this.proveedorNombre,
    this.fechaCompra,
    required this.estado,
    this.tipoOperacion,
    this.formaPago,
    required this.subtotal,
    this.impuestos,
    required this.total,
    this.createdAt,
  });

  /// ID de la compra
  String compraId;

  /// Número de factura
  String? numeroFactura;

  /// ID del proveedor
  String proveedorId;

  /// Nombre del proveedor
  String? proveedorNombre;

  /// Fecha de compra
  String? fechaCompra;

  /// Estado
  String estado;

  /// Tipo de operación
  String? tipoOperacion;

  /// Forma de pago
  String? formaPago;

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

  /// Creación
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Compra &&
    other.compraId == compraId &&
    other.numeroFactura == numeroFactura &&
    other.proveedorId == proveedorId &&
    other.proveedorNombre == proveedorNombre &&
    other.fechaCompra == fechaCompra &&
    other.estado == estado &&
    other.tipoOperacion == tipoOperacion &&
    other.formaPago == formaPago &&
    other.subtotal == subtotal &&
    other.impuestos == impuestos &&
    other.total == total &&
    other.createdAt == createdAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (compraId.hashCode) +
    (numeroFactura == null ? 0 : numeroFactura!.hashCode) +
    (proveedorId.hashCode) +
    (proveedorNombre == null ? 0 : proveedorNombre!.hashCode) +
    (fechaCompra == null ? 0 : fechaCompra!.hashCode) +
    (estado.hashCode) +
    (tipoOperacion == null ? 0 : tipoOperacion!.hashCode) +
    (formaPago == null ? 0 : formaPago!.hashCode) +
    (subtotal.hashCode) +
    (impuestos == null ? 0 : impuestos!.hashCode) +
    (total.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode);

  @override
  String toString() => 'Compra[compraId=$compraId, numeroFactura=$numeroFactura, proveedorId=$proveedorId, proveedorNombre=$proveedorNombre, fechaCompra=$fechaCompra, estado=$estado, tipoOperacion=$tipoOperacion, formaPago=$formaPago, subtotal=$subtotal, impuestos=$impuestos, total=$total, createdAt=$createdAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'compraId'] = this.compraId;
    if (this.numeroFactura != null) {
      json[r'numeroFactura'] = this.numeroFactura;
    } else {
      json[r'numeroFactura'] = null;
    }
      json[r'proveedorId'] = this.proveedorId;
    if (this.proveedorNombre != null) {
      json[r'proveedorNombre'] = this.proveedorNombre;
    } else {
      json[r'proveedorNombre'] = null;
    }
    if (this.fechaCompra != null) {
      json[r'fechaCompra'] = this.fechaCompra;
    } else {
      json[r'fechaCompra'] = null;
    }
      json[r'estado'] = this.estado;
    if (this.tipoOperacion != null) {
      json[r'tipoOperacion'] = this.tipoOperacion;
    } else {
      json[r'tipoOperacion'] = null;
    }
    if (this.formaPago != null) {
      json[r'formaPago'] = this.formaPago;
    } else {
      json[r'formaPago'] = null;
    }
      json[r'subtotal'] = this.subtotal;
    if (this.impuestos != null) {
      json[r'impuestos'] = this.impuestos;
    } else {
      json[r'impuestos'] = null;
    }
      json[r'total'] = this.total;
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    return json;
  }

  /// Returns a new [Compra] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Compra? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Compra[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Compra[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Compra(
        compraId: mapValueOfType<String>(json, r'compraId')!,
        numeroFactura: mapValueOfType<String>(json, r'numeroFactura'),
        proveedorId: mapValueOfType<String>(json, r'proveedorId')!,
        proveedorNombre: mapValueOfType<String>(json, r'proveedorNombre'),
        fechaCompra: mapValueOfType<String>(json, r'fechaCompra'),
        estado: mapValueOfType<String>(json, r'estado')!,
        tipoOperacion: mapValueOfType<String>(json, r'tipoOperacion'),
        formaPago: mapValueOfType<String>(json, r'formaPago'),
        subtotal: num.parse('${json[r'subtotal']}'),
        impuestos: num.parse('${json[r'impuestos']}'),
        total: num.parse('${json[r'total']}'),
        createdAt: mapDateTime(json, r'createdAt', r''),
      );
    }
    return null;
  }

  static List<Compra> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Compra>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Compra.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Compra> mapFromJson(dynamic json) {
    final map = <String, Compra>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Compra.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Compra-objects as value to a dart map
  static Map<String, List<Compra>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Compra>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Compra.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'compraId',
    'proveedorId',
    'estado',
    'subtotal',
    'total',
  };
}

