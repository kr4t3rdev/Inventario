//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Advance {
  /// Returns a new [Advance] instance.
  Advance({
    this.anticipoId,
    this.tipo,
    this.montoOriginal,
    this.saldoDisponible,
    this.moneda,
    this.estado,
    this.vigenciaHasta,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? anticipoId;

  AdvanceTipoEnum? tipo;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? montoOriginal;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? saldoDisponible;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? moneda;

  AdvanceEstadoEnum? estado;

  String? vigenciaHasta;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Advance &&
    other.anticipoId == anticipoId &&
    other.tipo == tipo &&
    other.montoOriginal == montoOriginal &&
    other.saldoDisponible == saldoDisponible &&
    other.moneda == moneda &&
    other.estado == estado &&
    other.vigenciaHasta == vigenciaHasta;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (anticipoId == null ? 0 : anticipoId!.hashCode) +
    (tipo == null ? 0 : tipo!.hashCode) +
    (montoOriginal == null ? 0 : montoOriginal!.hashCode) +
    (saldoDisponible == null ? 0 : saldoDisponible!.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (estado == null ? 0 : estado!.hashCode) +
    (vigenciaHasta == null ? 0 : vigenciaHasta!.hashCode);

  @override
  String toString() => 'Advance[anticipoId=$anticipoId, tipo=$tipo, montoOriginal=$montoOriginal, saldoDisponible=$saldoDisponible, moneda=$moneda, estado=$estado, vigenciaHasta=$vigenciaHasta]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.anticipoId != null) {
      json[r'anticipoId'] = this.anticipoId;
    } else {
      json[r'anticipoId'] = null;
    }
    if (this.tipo != null) {
      json[r'tipo'] = this.tipo;
    } else {
      json[r'tipo'] = null;
    }
    if (this.montoOriginal != null) {
      json[r'montoOriginal'] = this.montoOriginal;
    } else {
      json[r'montoOriginal'] = null;
    }
    if (this.saldoDisponible != null) {
      json[r'saldoDisponible'] = this.saldoDisponible;
    } else {
      json[r'saldoDisponible'] = null;
    }
    if (this.moneda != null) {
      json[r'moneda'] = this.moneda;
    } else {
      json[r'moneda'] = null;
    }
    if (this.estado != null) {
      json[r'estado'] = this.estado;
    } else {
      json[r'estado'] = null;
    }
    if (this.vigenciaHasta != null) {
      json[r'vigenciaHasta'] = this.vigenciaHasta;
    } else {
      json[r'vigenciaHasta'] = null;
    }
    return json;
  }

  /// Returns a new [Advance] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Advance? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Advance[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Advance[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Advance(
        anticipoId: mapValueOfType<String>(json, r'anticipoId'),
        tipo: AdvanceTipoEnum.fromJson(json[r'tipo']),
        montoOriginal: num.parse('${json[r'montoOriginal']}'),
        saldoDisponible: num.parse('${json[r'saldoDisponible']}'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        estado: AdvanceEstadoEnum.fromJson(json[r'estado']),
        vigenciaHasta: mapValueOfType<String>(json, r'vigenciaHasta'),
      );
    }
    return null;
  }

  static List<Advance> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Advance>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Advance.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Advance> mapFromJson(dynamic json) {
    final map = <String, Advance>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Advance.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Advance-objects as value to a dart map
  static Map<String, List<Advance>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Advance>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Advance.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}


class AdvanceTipoEnum {
  /// Instantiate a new enum with the provided [value].
  const AdvanceTipoEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const PAGO = AdvanceTipoEnum._(r'PAGO');
  static const COBRO = AdvanceTipoEnum._(r'COBRO');

  /// List of all possible values in this [enum][AdvanceTipoEnum].
  static const values = <AdvanceTipoEnum>[
    PAGO,
    COBRO,
  ];

  static AdvanceTipoEnum? fromJson(dynamic value) => AdvanceTipoEnumTypeTransformer().decode(value);

  static List<AdvanceTipoEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdvanceTipoEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdvanceTipoEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [AdvanceTipoEnum] to String,
/// and [decode] dynamic data back to [AdvanceTipoEnum].
class AdvanceTipoEnumTypeTransformer {
  factory AdvanceTipoEnumTypeTransformer() => _instance ??= const AdvanceTipoEnumTypeTransformer._();

  const AdvanceTipoEnumTypeTransformer._();

  String encode(AdvanceTipoEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a AdvanceTipoEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  AdvanceTipoEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'PAGO': return AdvanceTipoEnum.PAGO;
        case r'COBRO': return AdvanceTipoEnum.COBRO;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [AdvanceTipoEnumTypeTransformer] instance.
  static AdvanceTipoEnumTypeTransformer? _instance;
}



class AdvanceEstadoEnum {
  /// Instantiate a new enum with the provided [value].
  const AdvanceEstadoEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const RESERVADO = AdvanceEstadoEnum._(r'RESERVADO');
  static const EJECUTADO = AdvanceEstadoEnum._(r'EJECUTADO');
  static const ANULADO = AdvanceEstadoEnum._(r'ANULADO');

  /// List of all possible values in this [enum][AdvanceEstadoEnum].
  static const values = <AdvanceEstadoEnum>[
    RESERVADO,
    EJECUTADO,
    ANULADO,
  ];

  static AdvanceEstadoEnum? fromJson(dynamic value) => AdvanceEstadoEnumTypeTransformer().decode(value);

  static List<AdvanceEstadoEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdvanceEstadoEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdvanceEstadoEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [AdvanceEstadoEnum] to String,
/// and [decode] dynamic data back to [AdvanceEstadoEnum].
class AdvanceEstadoEnumTypeTransformer {
  factory AdvanceEstadoEnumTypeTransformer() => _instance ??= const AdvanceEstadoEnumTypeTransformer._();

  const AdvanceEstadoEnumTypeTransformer._();

  String encode(AdvanceEstadoEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a AdvanceEstadoEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  AdvanceEstadoEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'RESERVADO': return AdvanceEstadoEnum.RESERVADO;
        case r'EJECUTADO': return AdvanceEstadoEnum.EJECUTADO;
        case r'ANULADO': return AdvanceEstadoEnum.ANULADO;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [AdvanceEstadoEnumTypeTransformer] instance.
  static AdvanceEstadoEnumTypeTransformer? _instance;
}


