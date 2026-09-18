//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class BankAdjustmentRequest {
  /// Returns a new [BankAdjustmentRequest] instance.
  BankAdjustmentRequest({
    required this.cuentaId,
    required this.tipo,
    required this.monto,
    this.moneda = 'CUP',
    required this.descripcion,
    required this.motivo,
  });

  String cuentaId;

  BankAdjustmentRequestTipoEnum tipo;

  num monto;

  String moneda;

  String descripcion;

  String motivo;

  @override
  bool operator ==(Object other) => identical(this, other) || other is BankAdjustmentRequest &&
    other.cuentaId == cuentaId &&
    other.tipo == tipo &&
    other.monto == monto &&
    other.moneda == moneda &&
    other.descripcion == descripcion &&
    other.motivo == motivo;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (cuentaId.hashCode) +
    (tipo.hashCode) +
    (monto.hashCode) +
    (moneda.hashCode) +
    (descripcion.hashCode) +
    (motivo.hashCode);

  @override
  String toString() => 'BankAdjustmentRequest[cuentaId=$cuentaId, tipo=$tipo, monto=$monto, moneda=$moneda, descripcion=$descripcion, motivo=$motivo]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'cuentaId'] = this.cuentaId;
      json[r'tipo'] = this.tipo;
      json[r'monto'] = this.monto;
      json[r'moneda'] = this.moneda;
      json[r'descripcion'] = this.descripcion;
      json[r'motivo'] = this.motivo;
    return json;
  }

  /// Returns a new [BankAdjustmentRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static BankAdjustmentRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "BankAdjustmentRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "BankAdjustmentRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return BankAdjustmentRequest(
        cuentaId: mapValueOfType<String>(json, r'cuentaId')!,
        tipo: BankAdjustmentRequestTipoEnum.fromJson(json[r'tipo'])!,
        monto: num.parse('${json[r'monto']}'),
        moneda: mapValueOfType<String>(json, r'moneda') ?? 'CUP',
        descripcion: mapValueOfType<String>(json, r'descripcion')!,
        motivo: mapValueOfType<String>(json, r'motivo')!,
      );
    }
    return null;
  }

  static List<BankAdjustmentRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <BankAdjustmentRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = BankAdjustmentRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, BankAdjustmentRequest> mapFromJson(dynamic json) {
    final map = <String, BankAdjustmentRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = BankAdjustmentRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of BankAdjustmentRequest-objects as value to a dart map
  static Map<String, List<BankAdjustmentRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<BankAdjustmentRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = BankAdjustmentRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'cuentaId',
    'tipo',
    'monto',
    'descripcion',
    'motivo',
  };
}


class BankAdjustmentRequestTipoEnum {
  /// Instantiate a new enum with the provided [value].
  const BankAdjustmentRequestTipoEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const ingreso = BankAdjustmentRequestTipoEnum._(r'ingreso');
  static const egreso = BankAdjustmentRequestTipoEnum._(r'egreso');

  /// List of all possible values in this [enum][BankAdjustmentRequestTipoEnum].
  static const values = <BankAdjustmentRequestTipoEnum>[
    ingreso,
    egreso,
  ];

  static BankAdjustmentRequestTipoEnum? fromJson(dynamic value) => BankAdjustmentRequestTipoEnumTypeTransformer().decode(value);

  static List<BankAdjustmentRequestTipoEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <BankAdjustmentRequestTipoEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = BankAdjustmentRequestTipoEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [BankAdjustmentRequestTipoEnum] to String,
/// and [decode] dynamic data back to [BankAdjustmentRequestTipoEnum].
class BankAdjustmentRequestTipoEnumTypeTransformer {
  factory BankAdjustmentRequestTipoEnumTypeTransformer() => _instance ??= const BankAdjustmentRequestTipoEnumTypeTransformer._();

  const BankAdjustmentRequestTipoEnumTypeTransformer._();

  String encode(BankAdjustmentRequestTipoEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a BankAdjustmentRequestTipoEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  BankAdjustmentRequestTipoEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'ingreso': return BankAdjustmentRequestTipoEnum.ingreso;
        case r'egreso': return BankAdjustmentRequestTipoEnum.egreso;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [BankAdjustmentRequestTipoEnumTypeTransformer] instance.
  static BankAdjustmentRequestTipoEnumTypeTransformer? _instance;
}


