//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AjusteBancario {
  /// Returns a new [AjusteBancario] instance.
  AjusteBancario({
    required this.ajusteId,
    required this.tenantId,
    required this.cuentaId,
    required this.tipo,
    required this.monto,
    required this.moneda,
    this.tasaCambio,
    this.montoConvertido,
    required this.descripcion,
    required this.motivo,
    required this.realizadoPor,
    required this.fechaOperacion,
    required this.createdAt,
    required this.updatedAt,
  });

  String ajusteId;

  String tenantId;

  String cuentaId;

  AjusteBancarioTipoEnum tipo;

  /// Decimal serializado como texto.
  String monto;

  String moneda;

  String? tasaCambio;

  String? montoConvertido;

  String descripcion;

  String motivo;

  String realizadoPor;

  DateTime fechaOperacion;

  DateTime createdAt;

  DateTime updatedAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AjusteBancario &&
    other.ajusteId == ajusteId &&
    other.tenantId == tenantId &&
    other.cuentaId == cuentaId &&
    other.tipo == tipo &&
    other.monto == monto &&
    other.moneda == moneda &&
    other.tasaCambio == tasaCambio &&
    other.montoConvertido == montoConvertido &&
    other.descripcion == descripcion &&
    other.motivo == motivo &&
    other.realizadoPor == realizadoPor &&
    other.fechaOperacion == fechaOperacion &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ajusteId.hashCode) +
    (tenantId.hashCode) +
    (cuentaId.hashCode) +
    (tipo.hashCode) +
    (monto.hashCode) +
    (moneda.hashCode) +
    (tasaCambio == null ? 0 : tasaCambio!.hashCode) +
    (montoConvertido == null ? 0 : montoConvertido!.hashCode) +
    (descripcion.hashCode) +
    (motivo.hashCode) +
    (realizadoPor.hashCode) +
    (fechaOperacion.hashCode) +
    (createdAt.hashCode) +
    (updatedAt.hashCode);

  @override
  String toString() => 'AjusteBancario[ajusteId=$ajusteId, tenantId=$tenantId, cuentaId=$cuentaId, tipo=$tipo, monto=$monto, moneda=$moneda, tasaCambio=$tasaCambio, montoConvertido=$montoConvertido, descripcion=$descripcion, motivo=$motivo, realizadoPor=$realizadoPor, fechaOperacion=$fechaOperacion, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'ajusteId'] = this.ajusteId;
      json[r'tenantId'] = this.tenantId;
      json[r'cuentaId'] = this.cuentaId;
      json[r'tipo'] = this.tipo;
      json[r'monto'] = this.monto;
      json[r'moneda'] = this.moneda;
    if (this.tasaCambio != null) {
      json[r'tasaCambio'] = this.tasaCambio;
    } else {
      json[r'tasaCambio'] = null;
    }
    if (this.montoConvertido != null) {
      json[r'montoConvertido'] = this.montoConvertido;
    } else {
      json[r'montoConvertido'] = null;
    }
      json[r'descripcion'] = this.descripcion;
      json[r'motivo'] = this.motivo;
      json[r'realizadoPor'] = this.realizadoPor;
      json[r'fechaOperacion'] = this.fechaOperacion.toUtc().toIso8601String();
      json[r'createdAt'] = this.createdAt.toUtc().toIso8601String();
      json[r'updatedAt'] = this.updatedAt.toUtc().toIso8601String();
    return json;
  }

  /// Returns a new [AjusteBancario] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AjusteBancario? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AjusteBancario[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AjusteBancario[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AjusteBancario(
        ajusteId: mapValueOfType<String>(json, r'ajusteId')!,
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        cuentaId: mapValueOfType<String>(json, r'cuentaId')!,
        tipo: AjusteBancarioTipoEnum.fromJson(json[r'tipo'])!,
        monto: mapValueOfType<String>(json, r'monto')!,
        moneda: mapValueOfType<String>(json, r'moneda')!,
        tasaCambio: mapValueOfType<String>(json, r'tasaCambio'),
        montoConvertido: mapValueOfType<String>(json, r'montoConvertido'),
        descripcion: mapValueOfType<String>(json, r'descripcion')!,
        motivo: mapValueOfType<String>(json, r'motivo')!,
        realizadoPor: mapValueOfType<String>(json, r'realizadoPor')!,
        fechaOperacion: mapDateTime(json, r'fechaOperacion', r'')!,
        createdAt: mapDateTime(json, r'createdAt', r'')!,
        updatedAt: mapDateTime(json, r'updatedAt', r'')!,
      );
    }
    return null;
  }

  static List<AjusteBancario> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AjusteBancario>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AjusteBancario.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AjusteBancario> mapFromJson(dynamic json) {
    final map = <String, AjusteBancario>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AjusteBancario.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AjusteBancario-objects as value to a dart map
  static Map<String, List<AjusteBancario>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AjusteBancario>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AjusteBancario.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'ajusteId',
    'tenantId',
    'cuentaId',
    'tipo',
    'monto',
    'moneda',
    'descripcion',
    'motivo',
    'realizadoPor',
    'fechaOperacion',
    'createdAt',
    'updatedAt',
  };
}


class AjusteBancarioTipoEnum {
  /// Instantiate a new enum with the provided [value].
  const AjusteBancarioTipoEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const ingreso = AjusteBancarioTipoEnum._(r'ingreso');
  static const egreso = AjusteBancarioTipoEnum._(r'egreso');

  /// List of all possible values in this [enum][AjusteBancarioTipoEnum].
  static const values = <AjusteBancarioTipoEnum>[
    ingreso,
    egreso,
  ];

  static AjusteBancarioTipoEnum? fromJson(dynamic value) => AjusteBancarioTipoEnumTypeTransformer().decode(value);

  static List<AjusteBancarioTipoEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AjusteBancarioTipoEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AjusteBancarioTipoEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [AjusteBancarioTipoEnum] to String,
/// and [decode] dynamic data back to [AjusteBancarioTipoEnum].
class AjusteBancarioTipoEnumTypeTransformer {
  factory AjusteBancarioTipoEnumTypeTransformer() => _instance ??= const AjusteBancarioTipoEnumTypeTransformer._();

  const AjusteBancarioTipoEnumTypeTransformer._();

  String encode(AjusteBancarioTipoEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a AjusteBancarioTipoEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  AjusteBancarioTipoEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'ingreso': return AjusteBancarioTipoEnum.ingreso;
        case r'egreso': return AjusteBancarioTipoEnum.egreso;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [AjusteBancarioTipoEnumTypeTransformer] instance.
  static AjusteBancarioTipoEnumTypeTransformer? _instance;
}


