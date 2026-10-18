//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Transferencia {
  /// Returns a new [Transferencia] instance.
  Transferencia({
    required this.transferenciaId,
    this.numeroTransferencia,
    required this.productoId,
    required this.productoNombre,
    this.productoCodigo,
    required this.cantidad,
    this.costoUnitario,
    this.costoTotal,
    this.origenNombre,
    this.destinoNombre,
    required this.estado,
    required this.createdAt,
    this.updatedAt,
  });

  /// 
  String transferenciaId;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? numeroTransferencia;

  /// 
  String productoId;

  /// 
  String productoNombre;

  /// 
  String? productoCodigo;

  /// 
  num cantidad;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? costoUnitario;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? costoTotal;

  /// 
  String? origenNombre;

  /// 
  String? destinoNombre;

  /// 
  String estado;

  /// 
  DateTime createdAt;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? updatedAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Transferencia &&
    other.transferenciaId == transferenciaId &&
    other.numeroTransferencia == numeroTransferencia &&
    other.productoId == productoId &&
    other.productoNombre == productoNombre &&
    other.productoCodigo == productoCodigo &&
    other.cantidad == cantidad &&
    other.costoUnitario == costoUnitario &&
    other.costoTotal == costoTotal &&
    other.origenNombre == origenNombre &&
    other.destinoNombre == destinoNombre &&
    other.estado == estado &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (transferenciaId.hashCode) +
    (numeroTransferencia == null ? 0 : numeroTransferencia!.hashCode) +
    (productoId.hashCode) +
    (productoNombre.hashCode) +
    (productoCodigo == null ? 0 : productoCodigo!.hashCode) +
    (cantidad.hashCode) +
    (costoUnitario == null ? 0 : costoUnitario!.hashCode) +
    (costoTotal == null ? 0 : costoTotal!.hashCode) +
    (origenNombre == null ? 0 : origenNombre!.hashCode) +
    (destinoNombre == null ? 0 : destinoNombre!.hashCode) +
    (estado.hashCode) +
    (createdAt.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode);

  @override
  String toString() => 'Transferencia[transferenciaId=$transferenciaId, numeroTransferencia=$numeroTransferencia, productoId=$productoId, productoNombre=$productoNombre, productoCodigo=$productoCodigo, cantidad=$cantidad, costoUnitario=$costoUnitario, costoTotal=$costoTotal, origenNombre=$origenNombre, destinoNombre=$destinoNombre, estado=$estado, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'transferenciaId'] = this.transferenciaId;
    if (this.numeroTransferencia != null) {
      json[r'numeroTransferencia'] = this.numeroTransferencia;
    } else {
      json[r'numeroTransferencia'] = null;
    }
      json[r'productoId'] = this.productoId;
      json[r'productoNombre'] = this.productoNombre;
    if (this.productoCodigo != null) {
      json[r'productoCodigo'] = this.productoCodigo;
    } else {
      json[r'productoCodigo'] = null;
    }
      json[r'cantidad'] = this.cantidad;
    if (this.costoUnitario != null) {
      json[r'costoUnitario'] = this.costoUnitario;
    } else {
      json[r'costoUnitario'] = null;
    }
    if (this.costoTotal != null) {
      json[r'costoTotal'] = this.costoTotal;
    } else {
      json[r'costoTotal'] = null;
    }
    if (this.origenNombre != null) {
      json[r'origenNombre'] = this.origenNombre;
    } else {
      json[r'origenNombre'] = null;
    }
    if (this.destinoNombre != null) {
      json[r'destinoNombre'] = this.destinoNombre;
    } else {
      json[r'destinoNombre'] = null;
    }
      json[r'estado'] = this.estado;
      json[r'createdAt'] = this.createdAt.toUtc().toIso8601String();
    if (this.updatedAt != null) {
      json[r'updatedAt'] = this.updatedAt!.toUtc().toIso8601String();
    } else {
      json[r'updatedAt'] = null;
    }
    return json;
  }

  /// Returns a new [Transferencia] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Transferencia? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Transferencia[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Transferencia[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Transferencia(
        transferenciaId: mapValueOfType<String>(json, r'transferenciaId')!,
        numeroTransferencia: mapValueOfType<String>(json, r'numeroTransferencia'),
        productoId: mapValueOfType<String>(json, r'productoId')!,
        productoNombre: mapValueOfType<String>(json, r'productoNombre')!,
        productoCodigo: mapValueOfType<String>(json, r'productoCodigo'),
        cantidad: num.parse('${json[r'cantidad']}'),
        costoUnitario: num.parse('${json[r'costoUnitario']}'),
        costoTotal: num.parse('${json[r'costoTotal']}'),
        origenNombre: mapValueOfType<String>(json, r'origenNombre'),
        destinoNombre: mapValueOfType<String>(json, r'destinoNombre'),
        estado: mapValueOfType<String>(json, r'estado')!,
        createdAt: mapDateTime(json, r'createdAt', r'')!,
        updatedAt: mapDateTime(json, r'updatedAt', r''),
      );
    }
    return null;
  }

  static List<Transferencia> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Transferencia>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Transferencia.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Transferencia> mapFromJson(dynamic json) {
    final map = <String, Transferencia>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Transferencia.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Transferencia-objects as value to a dart map
  static Map<String, List<Transferencia>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Transferencia>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Transferencia.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'transferenciaId',
    'productoId',
    'productoNombre',
    'cantidad',
    'estado',
    'createdAt',
  };
}

