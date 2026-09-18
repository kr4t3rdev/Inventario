//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ExpenseReconciliationRequest {
  /// Returns a new [ExpenseReconciliationRequest] instance.
  ExpenseReconciliationRequest({
    required this.tipoGasto,
    this.pgId,
    this.gastosDEId,
    this.gastoCompraId,
    this.referenciaId,
    this.cuentaId,
    this.tipoPagoId,
    required this.monto,
    this.moneda = 'CUP',
    this.tasaCambio,
    required this.descripcion,
    this.periodo,
    this.observaciones,
    this.estado = const ExpenseReconciliationRequestEstadoEnum._('PAGADA'),
    this.cuentaPorPagarId,
    this.numeroTransaccion,
    this.distribucion = const [],
  });

  ExpenseReconciliationRequestTipoGastoEnum tipoGasto;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? pgId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? gastosDEId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? gastoCompraId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? referenciaId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? cuentaId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? tipoPagoId;

  num monto;

  String moneda;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? tasaCambio;

  String descripcion;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? periodo;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? observaciones;

  ExpenseReconciliationRequestEstadoEnum estado;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? cuentaPorPagarId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? numeroTransaccion;

  List<ExpenseDistributionRequest> distribucion;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ExpenseReconciliationRequest &&
    other.tipoGasto == tipoGasto &&
    other.pgId == pgId &&
    other.gastosDEId == gastosDEId &&
    other.gastoCompraId == gastoCompraId &&
    other.referenciaId == referenciaId &&
    other.cuentaId == cuentaId &&
    other.tipoPagoId == tipoPagoId &&
    other.monto == monto &&
    other.moneda == moneda &&
    other.tasaCambio == tasaCambio &&
    other.descripcion == descripcion &&
    other.periodo == periodo &&
    other.observaciones == observaciones &&
    other.estado == estado &&
    other.cuentaPorPagarId == cuentaPorPagarId &&
    other.numeroTransaccion == numeroTransaccion &&
    _deepEquality.equals(other.distribucion, distribucion);

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tipoGasto.hashCode) +
    (pgId == null ? 0 : pgId!.hashCode) +
    (gastosDEId == null ? 0 : gastosDEId!.hashCode) +
    (gastoCompraId == null ? 0 : gastoCompraId!.hashCode) +
    (referenciaId == null ? 0 : referenciaId!.hashCode) +
    (cuentaId == null ? 0 : cuentaId!.hashCode) +
    (tipoPagoId == null ? 0 : tipoPagoId!.hashCode) +
    (monto.hashCode) +
    (moneda.hashCode) +
    (tasaCambio == null ? 0 : tasaCambio!.hashCode) +
    (descripcion.hashCode) +
    (periodo == null ? 0 : periodo!.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode) +
    (estado.hashCode) +
    (cuentaPorPagarId == null ? 0 : cuentaPorPagarId!.hashCode) +
    (numeroTransaccion == null ? 0 : numeroTransaccion!.hashCode) +
    (distribucion.hashCode);

  @override
  String toString() => 'ExpenseReconciliationRequest[tipoGasto=$tipoGasto, pgId=$pgId, gastosDEId=$gastosDEId, gastoCompraId=$gastoCompraId, referenciaId=$referenciaId, cuentaId=$cuentaId, tipoPagoId=$tipoPagoId, monto=$monto, moneda=$moneda, tasaCambio=$tasaCambio, descripcion=$descripcion, periodo=$periodo, observaciones=$observaciones, estado=$estado, cuentaPorPagarId=$cuentaPorPagarId, numeroTransaccion=$numeroTransaccion, distribucion=$distribucion]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tipoGasto'] = this.tipoGasto;
    if (this.pgId != null) {
      json[r'pgId'] = this.pgId;
    } else {
      json[r'pgId'] = null;
    }
    if (this.gastosDEId != null) {
      json[r'gastosDEId'] = this.gastosDEId;
    } else {
      json[r'gastosDEId'] = null;
    }
    if (this.gastoCompraId != null) {
      json[r'gastoCompraId'] = this.gastoCompraId;
    } else {
      json[r'gastoCompraId'] = null;
    }
    if (this.referenciaId != null) {
      json[r'referenciaId'] = this.referenciaId;
    } else {
      json[r'referenciaId'] = null;
    }
    if (this.cuentaId != null) {
      json[r'cuentaId'] = this.cuentaId;
    } else {
      json[r'cuentaId'] = null;
    }
    if (this.tipoPagoId != null) {
      json[r'tipoPagoId'] = this.tipoPagoId;
    } else {
      json[r'tipoPagoId'] = null;
    }
      json[r'monto'] = this.monto;
      json[r'moneda'] = this.moneda;
    if (this.tasaCambio != null) {
      json[r'tasaCambio'] = this.tasaCambio;
    } else {
      json[r'tasaCambio'] = null;
    }
      json[r'descripcion'] = this.descripcion;
    if (this.periodo != null) {
      json[r'periodo'] = this.periodo;
    } else {
      json[r'periodo'] = null;
    }
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
      json[r'estado'] = this.estado;
    if (this.cuentaPorPagarId != null) {
      json[r'cuentaPorPagarId'] = this.cuentaPorPagarId;
    } else {
      json[r'cuentaPorPagarId'] = null;
    }
    if (this.numeroTransaccion != null) {
      json[r'numeroTransaccion'] = this.numeroTransaccion;
    } else {
      json[r'numeroTransaccion'] = null;
    }
      json[r'distribucion'] = this.distribucion;
    return json;
  }

  /// Returns a new [ExpenseReconciliationRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ExpenseReconciliationRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ExpenseReconciliationRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ExpenseReconciliationRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ExpenseReconciliationRequest(
        tipoGasto: ExpenseReconciliationRequestTipoGastoEnum.fromJson(json[r'tipoGasto'])!,
        pgId: mapValueOfType<String>(json, r'pgId'),
        gastosDEId: mapValueOfType<String>(json, r'gastosDEId'),
        gastoCompraId: mapValueOfType<String>(json, r'gastoCompraId'),
        referenciaId: mapValueOfType<String>(json, r'referenciaId'),
        cuentaId: mapValueOfType<String>(json, r'cuentaId'),
        tipoPagoId: mapValueOfType<String>(json, r'tipoPagoId'),
        monto: num.parse('${json[r'monto']}'),
        moneda: mapValueOfType<String>(json, r'moneda') ?? 'CUP',
        tasaCambio: num.parse('${json[r'tasaCambio']}'),
        descripcion: mapValueOfType<String>(json, r'descripcion')!,
        periodo: mapValueOfType<String>(json, r'periodo'),
        observaciones: mapValueOfType<String>(json, r'observaciones'),
        estado: ExpenseReconciliationRequestEstadoEnum.fromJson(json[r'estado']) ?? 'PAGADA',
        cuentaPorPagarId: mapValueOfType<String>(json, r'cuentaPorPagarId'),
        numeroTransaccion: mapValueOfType<String>(json, r'numeroTransaccion'),
        distribucion: ExpenseDistributionRequest.listFromJson(json[r'distribucion']),
      );
    }
    return null;
  }

  static List<ExpenseReconciliationRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ExpenseReconciliationRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ExpenseReconciliationRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ExpenseReconciliationRequest> mapFromJson(dynamic json) {
    final map = <String, ExpenseReconciliationRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ExpenseReconciliationRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ExpenseReconciliationRequest-objects as value to a dart map
  static Map<String, List<ExpenseReconciliationRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ExpenseReconciliationRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ExpenseReconciliationRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tipoGasto',
    'monto',
    'descripcion',
  };
}


class ExpenseReconciliationRequestTipoGastoEnum {
  /// Instantiate a new enum with the provided [value].
  const ExpenseReconciliationRequestTipoGastoEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const salario = ExpenseReconciliationRequestTipoGastoEnum._(r'salario');
  static const gastoDE = ExpenseReconciliationRequestTipoGastoEnum._(r'gastoDE');
  static const compra = ExpenseReconciliationRequestTipoGastoEnum._(r'compra');

  /// List of all possible values in this [enum][ExpenseReconciliationRequestTipoGastoEnum].
  static const values = <ExpenseReconciliationRequestTipoGastoEnum>[
    salario,
    gastoDE,
    compra,
  ];

  static ExpenseReconciliationRequestTipoGastoEnum? fromJson(dynamic value) => ExpenseReconciliationRequestTipoGastoEnumTypeTransformer().decode(value);

  static List<ExpenseReconciliationRequestTipoGastoEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ExpenseReconciliationRequestTipoGastoEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ExpenseReconciliationRequestTipoGastoEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [ExpenseReconciliationRequestTipoGastoEnum] to String,
/// and [decode] dynamic data back to [ExpenseReconciliationRequestTipoGastoEnum].
class ExpenseReconciliationRequestTipoGastoEnumTypeTransformer {
  factory ExpenseReconciliationRequestTipoGastoEnumTypeTransformer() => _instance ??= const ExpenseReconciliationRequestTipoGastoEnumTypeTransformer._();

  const ExpenseReconciliationRequestTipoGastoEnumTypeTransformer._();

  String encode(ExpenseReconciliationRequestTipoGastoEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a ExpenseReconciliationRequestTipoGastoEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  ExpenseReconciliationRequestTipoGastoEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'salario': return ExpenseReconciliationRequestTipoGastoEnum.salario;
        case r'gastoDE': return ExpenseReconciliationRequestTipoGastoEnum.gastoDE;
        case r'compra': return ExpenseReconciliationRequestTipoGastoEnum.compra;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [ExpenseReconciliationRequestTipoGastoEnumTypeTransformer] instance.
  static ExpenseReconciliationRequestTipoGastoEnumTypeTransformer? _instance;
}



class ExpenseReconciliationRequestEstadoEnum {
  /// Instantiate a new enum with the provided [value].
  const ExpenseReconciliationRequestEstadoEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const PENDIENTE = ExpenseReconciliationRequestEstadoEnum._(r'PENDIENTE');
  static const PAGADA = ExpenseReconciliationRequestEstadoEnum._(r'PAGADA');
  static const PARCIAL = ExpenseReconciliationRequestEstadoEnum._(r'PARCIAL');

  /// List of all possible values in this [enum][ExpenseReconciliationRequestEstadoEnum].
  static const values = <ExpenseReconciliationRequestEstadoEnum>[
    PENDIENTE,
    PAGADA,
    PARCIAL,
  ];

  static ExpenseReconciliationRequestEstadoEnum? fromJson(dynamic value) => ExpenseReconciliationRequestEstadoEnumTypeTransformer().decode(value);

  static List<ExpenseReconciliationRequestEstadoEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ExpenseReconciliationRequestEstadoEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ExpenseReconciliationRequestEstadoEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [ExpenseReconciliationRequestEstadoEnum] to String,
/// and [decode] dynamic data back to [ExpenseReconciliationRequestEstadoEnum].
class ExpenseReconciliationRequestEstadoEnumTypeTransformer {
  factory ExpenseReconciliationRequestEstadoEnumTypeTransformer() => _instance ??= const ExpenseReconciliationRequestEstadoEnumTypeTransformer._();

  const ExpenseReconciliationRequestEstadoEnumTypeTransformer._();

  String encode(ExpenseReconciliationRequestEstadoEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a ExpenseReconciliationRequestEstadoEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  ExpenseReconciliationRequestEstadoEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'PENDIENTE': return ExpenseReconciliationRequestEstadoEnum.PENDIENTE;
        case r'PAGADA': return ExpenseReconciliationRequestEstadoEnum.PAGADA;
        case r'PARCIAL': return ExpenseReconciliationRequestEstadoEnum.PARCIAL;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [ExpenseReconciliationRequestEstadoEnumTypeTransformer] instance.
  static ExpenseReconciliationRequestEstadoEnumTypeTransformer? _instance;
}


