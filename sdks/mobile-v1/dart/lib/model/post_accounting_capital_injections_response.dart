//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingCapitalInjectionsResponse {
  /// Returns a new [PostAccountingCapitalInjectionsResponse] instance.
  PostAccountingCapitalInjectionsResponse({
    required this.id,
    this.tenantId,
    required this.tipo,
    required this.montoRecibido,
    required this.moneda,
    this.tasaInteres,
    this.montoInteres,
    this.montoTotalDeuda,
    this.saldoPendiente,
    this.plazoMeses,
    this.fechaInicioPago,
    this.socio,
    this.entidadPrestamista,
    required this.cuentaId,
    this.estado,
    this.descripcion,
    required this.fechaRegistro,
    required this.createdAt,
    required this.updatedAt,
  });

  String id;

  String? tenantId;

  PostAccountingCapitalInjectionsResponseTipoEnum tipo;

  /// Decimal serializado como texto.
  String montoRecibido;

  String moneda;

  String? tasaInteres;

  String? montoInteres;

  String? montoTotalDeuda;

  String? saldoPendiente;

  int? plazoMeses;

  DateTime? fechaInicioPago;

  String? socio;

  String? entidadPrestamista;

  String cuentaId;

  String? estado;

  String? descripcion;

  DateTime fechaRegistro;

  DateTime createdAt;

  DateTime updatedAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingCapitalInjectionsResponse &&
    other.id == id &&
    other.tenantId == tenantId &&
    other.tipo == tipo &&
    other.montoRecibido == montoRecibido &&
    other.moneda == moneda &&
    other.tasaInteres == tasaInteres &&
    other.montoInteres == montoInteres &&
    other.montoTotalDeuda == montoTotalDeuda &&
    other.saldoPendiente == saldoPendiente &&
    other.plazoMeses == plazoMeses &&
    other.fechaInicioPago == fechaInicioPago &&
    other.socio == socio &&
    other.entidadPrestamista == entidadPrestamista &&
    other.cuentaId == cuentaId &&
    other.estado == estado &&
    other.descripcion == descripcion &&
    other.fechaRegistro == fechaRegistro &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id.hashCode) +
    (tenantId == null ? 0 : tenantId!.hashCode) +
    (tipo.hashCode) +
    (montoRecibido.hashCode) +
    (moneda.hashCode) +
    (tasaInteres == null ? 0 : tasaInteres!.hashCode) +
    (montoInteres == null ? 0 : montoInteres!.hashCode) +
    (montoTotalDeuda == null ? 0 : montoTotalDeuda!.hashCode) +
    (saldoPendiente == null ? 0 : saldoPendiente!.hashCode) +
    (plazoMeses == null ? 0 : plazoMeses!.hashCode) +
    (fechaInicioPago == null ? 0 : fechaInicioPago!.hashCode) +
    (socio == null ? 0 : socio!.hashCode) +
    (entidadPrestamista == null ? 0 : entidadPrestamista!.hashCode) +
    (cuentaId.hashCode) +
    (estado == null ? 0 : estado!.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode) +
    (fechaRegistro.hashCode) +
    (createdAt.hashCode) +
    (updatedAt.hashCode);

  @override
  String toString() => 'PostAccountingCapitalInjectionsResponse[id=$id, tenantId=$tenantId, tipo=$tipo, montoRecibido=$montoRecibido, moneda=$moneda, tasaInteres=$tasaInteres, montoInteres=$montoInteres, montoTotalDeuda=$montoTotalDeuda, saldoPendiente=$saldoPendiente, plazoMeses=$plazoMeses, fechaInicioPago=$fechaInicioPago, socio=$socio, entidadPrestamista=$entidadPrestamista, cuentaId=$cuentaId, estado=$estado, descripcion=$descripcion, fechaRegistro=$fechaRegistro, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'id'] = this.id;
    if (this.tenantId != null) {
      json[r'tenantId'] = this.tenantId;
    } else {
      json[r'tenantId'] = null;
    }
      json[r'tipo'] = this.tipo;
      json[r'montoRecibido'] = this.montoRecibido;
      json[r'moneda'] = this.moneda;
    if (this.tasaInteres != null) {
      json[r'tasaInteres'] = this.tasaInteres;
    } else {
      json[r'tasaInteres'] = null;
    }
    if (this.montoInteres != null) {
      json[r'montoInteres'] = this.montoInteres;
    } else {
      json[r'montoInteres'] = null;
    }
    if (this.montoTotalDeuda != null) {
      json[r'montoTotalDeuda'] = this.montoTotalDeuda;
    } else {
      json[r'montoTotalDeuda'] = null;
    }
    if (this.saldoPendiente != null) {
      json[r'saldoPendiente'] = this.saldoPendiente;
    } else {
      json[r'saldoPendiente'] = null;
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
      json[r'cuentaId'] = this.cuentaId;
    if (this.estado != null) {
      json[r'estado'] = this.estado;
    } else {
      json[r'estado'] = null;
    }
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
      json[r'fechaRegistro'] = this.fechaRegistro.toUtc().toIso8601String();
      json[r'createdAt'] = this.createdAt.toUtc().toIso8601String();
      json[r'updatedAt'] = this.updatedAt.toUtc().toIso8601String();
    return json;
  }

  /// Returns a new [PostAccountingCapitalInjectionsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingCapitalInjectionsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingCapitalInjectionsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingCapitalInjectionsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingCapitalInjectionsResponse(
        id: mapValueOfType<String>(json, r'id')!,
        tenantId: mapValueOfType<String>(json, r'tenantId'),
        tipo: PostAccountingCapitalInjectionsResponseTipoEnum.fromJson(json[r'tipo'])!,
        montoRecibido: mapValueOfType<String>(json, r'montoRecibido')!,
        moneda: mapValueOfType<String>(json, r'moneda')!,
        tasaInteres: mapValueOfType<String>(json, r'tasaInteres'),
        montoInteres: mapValueOfType<String>(json, r'montoInteres'),
        montoTotalDeuda: mapValueOfType<String>(json, r'montoTotalDeuda'),
        saldoPendiente: mapValueOfType<String>(json, r'saldoPendiente'),
        plazoMeses: mapValueOfType<int>(json, r'plazoMeses'),
        fechaInicioPago: mapDateTime(json, r'fechaInicioPago', r''),
        socio: mapValueOfType<String>(json, r'socio'),
        entidadPrestamista: mapValueOfType<String>(json, r'entidadPrestamista'),
        cuentaId: mapValueOfType<String>(json, r'cuentaId')!,
        estado: mapValueOfType<String>(json, r'estado'),
        descripcion: mapValueOfType<String>(json, r'descripcion'),
        fechaRegistro: mapDateTime(json, r'fechaRegistro', r'')!,
        createdAt: mapDateTime(json, r'createdAt', r'')!,
        updatedAt: mapDateTime(json, r'updatedAt', r'')!,
      );
    }
    return null;
  }

  static List<PostAccountingCapitalInjectionsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingCapitalInjectionsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingCapitalInjectionsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingCapitalInjectionsResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingCapitalInjectionsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingCapitalInjectionsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingCapitalInjectionsResponse-objects as value to a dart map
  static Map<String, List<PostAccountingCapitalInjectionsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingCapitalInjectionsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingCapitalInjectionsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'id',
    'tipo',
    'montoRecibido',
    'moneda',
    'cuentaId',
    'fechaRegistro',
    'createdAt',
    'updatedAt',
  };
}


class PostAccountingCapitalInjectionsResponseTipoEnum {
  /// Instantiate a new enum with the provided [value].
  const PostAccountingCapitalInjectionsResponseTipoEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const CAPITAL_SOCIAL = PostAccountingCapitalInjectionsResponseTipoEnum._(r'CAPITAL_SOCIAL');
  static const DEUDA_EXTERNA = PostAccountingCapitalInjectionsResponseTipoEnum._(r'DEUDA_EXTERNA');

  /// List of all possible values in this [enum][PostAccountingCapitalInjectionsResponseTipoEnum].
  static const values = <PostAccountingCapitalInjectionsResponseTipoEnum>[
    CAPITAL_SOCIAL,
    DEUDA_EXTERNA,
  ];

  static PostAccountingCapitalInjectionsResponseTipoEnum? fromJson(dynamic value) => PostAccountingCapitalInjectionsResponseTipoEnumTypeTransformer().decode(value);

  static List<PostAccountingCapitalInjectionsResponseTipoEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingCapitalInjectionsResponseTipoEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingCapitalInjectionsResponseTipoEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [PostAccountingCapitalInjectionsResponseTipoEnum] to String,
/// and [decode] dynamic data back to [PostAccountingCapitalInjectionsResponseTipoEnum].
class PostAccountingCapitalInjectionsResponseTipoEnumTypeTransformer {
  factory PostAccountingCapitalInjectionsResponseTipoEnumTypeTransformer() => _instance ??= const PostAccountingCapitalInjectionsResponseTipoEnumTypeTransformer._();

  const PostAccountingCapitalInjectionsResponseTipoEnumTypeTransformer._();

  String encode(PostAccountingCapitalInjectionsResponseTipoEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a PostAccountingCapitalInjectionsResponseTipoEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  PostAccountingCapitalInjectionsResponseTipoEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'CAPITAL_SOCIAL': return PostAccountingCapitalInjectionsResponseTipoEnum.CAPITAL_SOCIAL;
        case r'DEUDA_EXTERNA': return PostAccountingCapitalInjectionsResponseTipoEnum.DEUDA_EXTERNA;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [PostAccountingCapitalInjectionsResponseTipoEnumTypeTransformer] instance.
  static PostAccountingCapitalInjectionsResponseTipoEnumTypeTransformer? _instance;
}


