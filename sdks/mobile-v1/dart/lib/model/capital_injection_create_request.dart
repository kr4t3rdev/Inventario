//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class CapitalInjectionCreateRequest {
  /// Returns a new [CapitalInjectionCreateRequest] instance.
  CapitalInjectionCreateRequest({
    required this.montoRecibido,
    this.moneda = 'CUP',
    required this.tipo,
    required this.cuentaId,
    this.descripcion,
    this.socio,
    this.entidadPrestamista,
    this.tasaInteres,
    this.plazoMeses,
    this.fechaInicioPago,
    this.fechaOperacion,
  });

  num montoRecibido;

  String moneda;

  CapitalInjectionCreateRequestTipoEnum tipo;

  String cuentaId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? descripcion;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? socio;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? entidadPrestamista;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? tasaInteres;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? plazoMeses;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? fechaInicioPago;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? fechaOperacion;

  @override
  bool operator ==(Object other) => identical(this, other) || other is CapitalInjectionCreateRequest &&
    other.montoRecibido == montoRecibido &&
    other.moneda == moneda &&
    other.tipo == tipo &&
    other.cuentaId == cuentaId &&
    other.descripcion == descripcion &&
    other.socio == socio &&
    other.entidadPrestamista == entidadPrestamista &&
    other.tasaInteres == tasaInteres &&
    other.plazoMeses == plazoMeses &&
    other.fechaInicioPago == fechaInicioPago &&
    other.fechaOperacion == fechaOperacion;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (montoRecibido.hashCode) +
    (moneda.hashCode) +
    (tipo.hashCode) +
    (cuentaId.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode) +
    (socio == null ? 0 : socio!.hashCode) +
    (entidadPrestamista == null ? 0 : entidadPrestamista!.hashCode) +
    (tasaInteres == null ? 0 : tasaInteres!.hashCode) +
    (plazoMeses == null ? 0 : plazoMeses!.hashCode) +
    (fechaInicioPago == null ? 0 : fechaInicioPago!.hashCode) +
    (fechaOperacion == null ? 0 : fechaOperacion!.hashCode);

  @override
  String toString() => 'CapitalInjectionCreateRequest[montoRecibido=$montoRecibido, moneda=$moneda, tipo=$tipo, cuentaId=$cuentaId, descripcion=$descripcion, socio=$socio, entidadPrestamista=$entidadPrestamista, tasaInteres=$tasaInteres, plazoMeses=$plazoMeses, fechaInicioPago=$fechaInicioPago, fechaOperacion=$fechaOperacion]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'montoRecibido'] = this.montoRecibido;
      json[r'moneda'] = this.moneda;
      json[r'tipo'] = this.tipo;
      json[r'cuentaId'] = this.cuentaId;
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
    if (this.socio != null) {
      json[r'socio'] = this.socio;
    } else {
      json[r'socio'] = null;
    }
    if (this.entidadPrestamista != null) {
      json[r'entidadPrestamista'] = this.entidadPrestamista;
    } else {
      json[r'entidadPrestamista'] = null;
    }
    if (this.tasaInteres != null) {
      json[r'tasaInteres'] = this.tasaInteres;
    } else {
      json[r'tasaInteres'] = null;
    }
    if (this.plazoMeses != null) {
      json[r'plazoMeses'] = this.plazoMeses;
    } else {
      json[r'plazoMeses'] = null;
    }
    if (this.fechaInicioPago != null) {
      json[r'fechaInicioPago'] = this.fechaInicioPago!.toUtc().toIso8601String();
    } else {
      json[r'fechaInicioPago'] = null;
    }
    if (this.fechaOperacion != null) {
      json[r'fechaOperacion'] = this.fechaOperacion!.toUtc().toIso8601String();
    } else {
      json[r'fechaOperacion'] = null;
    }
    return json;
  }

  /// Returns a new [CapitalInjectionCreateRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static CapitalInjectionCreateRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "CapitalInjectionCreateRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "CapitalInjectionCreateRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return CapitalInjectionCreateRequest(
        montoRecibido: num.parse('${json[r'montoRecibido']}'),
        moneda: mapValueOfType<String>(json, r'moneda') ?? 'CUP',
        tipo: CapitalInjectionCreateRequestTipoEnum.fromJson(json[r'tipo'])!,
        cuentaId: mapValueOfType<String>(json, r'cuentaId')!,
        descripcion: mapValueOfType<String>(json, r'descripcion'),
        socio: mapValueOfType<String>(json, r'socio'),
        entidadPrestamista: mapValueOfType<String>(json, r'entidadPrestamista'),
        tasaInteres: num.parse('${json[r'tasaInteres']}'),
        plazoMeses: mapValueOfType<int>(json, r'plazoMeses'),
        fechaInicioPago: mapDateTime(json, r'fechaInicioPago', r''),
        fechaOperacion: mapDateTime(json, r'fechaOperacion', r''),
      );
    }
    return null;
  }

  static List<CapitalInjectionCreateRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <CapitalInjectionCreateRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = CapitalInjectionCreateRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, CapitalInjectionCreateRequest> mapFromJson(dynamic json) {
    final map = <String, CapitalInjectionCreateRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = CapitalInjectionCreateRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of CapitalInjectionCreateRequest-objects as value to a dart map
  static Map<String, List<CapitalInjectionCreateRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<CapitalInjectionCreateRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = CapitalInjectionCreateRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'montoRecibido',
    'tipo',
    'cuentaId',
  };
}


class CapitalInjectionCreateRequestTipoEnum {
  /// Instantiate a new enum with the provided [value].
  const CapitalInjectionCreateRequestTipoEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const CAPITAL_SOCIAL = CapitalInjectionCreateRequestTipoEnum._(r'CAPITAL_SOCIAL');
  static const DEUDA_EXTERNA = CapitalInjectionCreateRequestTipoEnum._(r'DEUDA_EXTERNA');

  /// List of all possible values in this [enum][CapitalInjectionCreateRequestTipoEnum].
  static const values = <CapitalInjectionCreateRequestTipoEnum>[
    CAPITAL_SOCIAL,
    DEUDA_EXTERNA,
  ];

  static CapitalInjectionCreateRequestTipoEnum? fromJson(dynamic value) => CapitalInjectionCreateRequestTipoEnumTypeTransformer().decode(value);

  static List<CapitalInjectionCreateRequestTipoEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <CapitalInjectionCreateRequestTipoEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = CapitalInjectionCreateRequestTipoEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [CapitalInjectionCreateRequestTipoEnum] to String,
/// and [decode] dynamic data back to [CapitalInjectionCreateRequestTipoEnum].
class CapitalInjectionCreateRequestTipoEnumTypeTransformer {
  factory CapitalInjectionCreateRequestTipoEnumTypeTransformer() => _instance ??= const CapitalInjectionCreateRequestTipoEnumTypeTransformer._();

  const CapitalInjectionCreateRequestTipoEnumTypeTransformer._();

  String encode(CapitalInjectionCreateRequestTipoEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a CapitalInjectionCreateRequestTipoEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  CapitalInjectionCreateRequestTipoEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'CAPITAL_SOCIAL': return CapitalInjectionCreateRequestTipoEnum.CAPITAL_SOCIAL;
        case r'DEUDA_EXTERNA': return CapitalInjectionCreateRequestTipoEnum.DEUDA_EXTERNA;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [CapitalInjectionCreateRequestTipoEnumTypeTransformer] instance.
  static CapitalInjectionCreateRequestTipoEnumTypeTransformer? _instance;
}


