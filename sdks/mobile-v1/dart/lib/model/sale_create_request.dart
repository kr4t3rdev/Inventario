//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class SaleCreateRequest {
  /// Returns a new [SaleCreateRequest] instance.
  SaleCreateRequest({
    required this.puntoDeVentaId,
    this.clienteId,
    this.empleadoId,
    this.descuento = 0,
    this.observaciones,
    this.items = const [],
    this.turnoId,
    this.metodoPago,
    this.montoEfectivo,
    this.montoTarjeta,
    this.montoTransferencia,
    this.montoCredito,
    this.tipoVencimiento,
    this.fechaVencimiento,
    this.cuentaBancariaId,
  });

  String puntoDeVentaId;

  String? clienteId;

  String? empleadoId;

  /// Minimum value: 0
  int descuento;

  String? observaciones;

  List<SaleItemRequest> items;

  String? turnoId;

  String? metodoPago;

  num? montoEfectivo;

  num? montoTarjeta;

  num? montoTransferencia;

  num? montoCredito;

  SaleCreateRequestTipoVencimientoEnum? tipoVencimiento;

  String? fechaVencimiento;

  String? cuentaBancariaId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is SaleCreateRequest &&
    other.puntoDeVentaId == puntoDeVentaId &&
    other.clienteId == clienteId &&
    other.empleadoId == empleadoId &&
    other.descuento == descuento &&
    other.observaciones == observaciones &&
    _deepEquality.equals(other.items, items) &&
    other.turnoId == turnoId &&
    other.metodoPago == metodoPago &&
    other.montoEfectivo == montoEfectivo &&
    other.montoTarjeta == montoTarjeta &&
    other.montoTransferencia == montoTransferencia &&
    other.montoCredito == montoCredito &&
    other.tipoVencimiento == tipoVencimiento &&
    other.fechaVencimiento == fechaVencimiento &&
    other.cuentaBancariaId == cuentaBancariaId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (puntoDeVentaId.hashCode) +
    (clienteId == null ? 0 : clienteId!.hashCode) +
    (empleadoId == null ? 0 : empleadoId!.hashCode) +
    (descuento.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode) +
    (items.hashCode) +
    (turnoId == null ? 0 : turnoId!.hashCode) +
    (metodoPago == null ? 0 : metodoPago!.hashCode) +
    (montoEfectivo == null ? 0 : montoEfectivo!.hashCode) +
    (montoTarjeta == null ? 0 : montoTarjeta!.hashCode) +
    (montoTransferencia == null ? 0 : montoTransferencia!.hashCode) +
    (montoCredito == null ? 0 : montoCredito!.hashCode) +
    (tipoVencimiento == null ? 0 : tipoVencimiento!.hashCode) +
    (fechaVencimiento == null ? 0 : fechaVencimiento!.hashCode) +
    (cuentaBancariaId == null ? 0 : cuentaBancariaId!.hashCode);

  @override
  String toString() => 'SaleCreateRequest[puntoDeVentaId=$puntoDeVentaId, clienteId=$clienteId, empleadoId=$empleadoId, descuento=$descuento, observaciones=$observaciones, items=$items, turnoId=$turnoId, metodoPago=$metodoPago, montoEfectivo=$montoEfectivo, montoTarjeta=$montoTarjeta, montoTransferencia=$montoTransferencia, montoCredito=$montoCredito, tipoVencimiento=$tipoVencimiento, fechaVencimiento=$fechaVencimiento, cuentaBancariaId=$cuentaBancariaId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'puntoDeVentaId'] = this.puntoDeVentaId;
    if (this.clienteId != null) {
      json[r'clienteId'] = this.clienteId;
    } else {
      json[r'clienteId'] = null;
    }
    if (this.empleadoId != null) {
      json[r'empleadoId'] = this.empleadoId;
    } else {
      json[r'empleadoId'] = null;
    }
      json[r'descuento'] = this.descuento;
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
      json[r'items'] = this.items;
    if (this.turnoId != null) {
      json[r'turnoId'] = this.turnoId;
    } else {
      json[r'turnoId'] = null;
    }
    if (this.metodoPago != null) {
      json[r'metodoPago'] = this.metodoPago;
    } else {
      json[r'metodoPago'] = null;
    }
    if (this.montoEfectivo != null) {
      json[r'montoEfectivo'] = this.montoEfectivo;
    } else {
      json[r'montoEfectivo'] = null;
    }
    if (this.montoTarjeta != null) {
      json[r'montoTarjeta'] = this.montoTarjeta;
    } else {
      json[r'montoTarjeta'] = null;
    }
    if (this.montoTransferencia != null) {
      json[r'montoTransferencia'] = this.montoTransferencia;
    } else {
      json[r'montoTransferencia'] = null;
    }
    if (this.montoCredito != null) {
      json[r'montoCredito'] = this.montoCredito;
    } else {
      json[r'montoCredito'] = null;
    }
    if (this.tipoVencimiento != null) {
      json[r'tipoVencimiento'] = this.tipoVencimiento;
    } else {
      json[r'tipoVencimiento'] = null;
    }
    if (this.fechaVencimiento != null) {
      json[r'fechaVencimiento'] = this.fechaVencimiento;
    } else {
      json[r'fechaVencimiento'] = null;
    }
    if (this.cuentaBancariaId != null) {
      json[r'cuentaBancariaId'] = this.cuentaBancariaId;
    } else {
      json[r'cuentaBancariaId'] = null;
    }
    return json;
  }

  /// Returns a new [SaleCreateRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static SaleCreateRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "SaleCreateRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "SaleCreateRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return SaleCreateRequest(
        puntoDeVentaId: mapValueOfType<String>(json, r'puntoDeVentaId')!,
        clienteId: mapValueOfType<String>(json, r'clienteId'),
        empleadoId: mapValueOfType<String>(json, r'empleadoId'),
        descuento: mapValueOfType<int>(json, r'descuento') ?? 0,
        observaciones: mapValueOfType<String>(json, r'observaciones'),
        items: SaleItemRequest.listFromJson(json[r'items']),
        turnoId: mapValueOfType<String>(json, r'turnoId'),
        metodoPago: mapValueOfType<String>(json, r'metodoPago'),
        montoEfectivo: json[r'montoEfectivo'] == null
            ? null
            : num.parse('${json[r'montoEfectivo']}'),
        montoTarjeta: json[r'montoTarjeta'] == null
            ? null
            : num.parse('${json[r'montoTarjeta']}'),
        montoTransferencia: json[r'montoTransferencia'] == null
            ? null
            : num.parse('${json[r'montoTransferencia']}'),
        montoCredito: json[r'montoCredito'] == null
            ? null
            : num.parse('${json[r'montoCredito']}'),
        tipoVencimiento: SaleCreateRequestTipoVencimientoEnum.fromJson(json[r'tipoVencimiento']),
        fechaVencimiento: mapValueOfType<String>(json, r'fechaVencimiento'),
        cuentaBancariaId: mapValueOfType<String>(json, r'cuentaBancariaId'),
      );
    }
    return null;
  }

  static List<SaleCreateRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <SaleCreateRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = SaleCreateRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, SaleCreateRequest> mapFromJson(dynamic json) {
    final map = <String, SaleCreateRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = SaleCreateRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of SaleCreateRequest-objects as value to a dart map
  static Map<String, List<SaleCreateRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<SaleCreateRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = SaleCreateRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'puntoDeVentaId',
    'items',
  };
}


class SaleCreateRequestTipoVencimientoEnum {
  /// Instantiate a new enum with the provided [value].
  const SaleCreateRequestTipoVencimientoEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const contraPago = SaleCreateRequestTipoVencimientoEnum._(r'contra_pago');
  static const fecha = SaleCreateRequestTipoVencimientoEnum._(r'fecha');
  static const plazo = SaleCreateRequestTipoVencimientoEnum._(r'plazo');

  /// List of all possible values in this [enum][SaleCreateRequestTipoVencimientoEnum].
  static const values = <SaleCreateRequestTipoVencimientoEnum>[
    contraPago,
    fecha,
    plazo,
  ];

  static SaleCreateRequestTipoVencimientoEnum? fromJson(dynamic value) => SaleCreateRequestTipoVencimientoEnumTypeTransformer().decode(value);

  static List<SaleCreateRequestTipoVencimientoEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <SaleCreateRequestTipoVencimientoEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = SaleCreateRequestTipoVencimientoEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [SaleCreateRequestTipoVencimientoEnum] to String,
/// and [decode] dynamic data back to [SaleCreateRequestTipoVencimientoEnum].
class SaleCreateRequestTipoVencimientoEnumTypeTransformer {
  factory SaleCreateRequestTipoVencimientoEnumTypeTransformer() => _instance ??= const SaleCreateRequestTipoVencimientoEnumTypeTransformer._();

  const SaleCreateRequestTipoVencimientoEnumTypeTransformer._();

  String encode(SaleCreateRequestTipoVencimientoEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a SaleCreateRequestTipoVencimientoEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  SaleCreateRequestTipoVencimientoEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'contra_pago': return SaleCreateRequestTipoVencimientoEnum.contraPago;
        case r'fecha': return SaleCreateRequestTipoVencimientoEnum.fecha;
        case r'plazo': return SaleCreateRequestTipoVencimientoEnum.plazo;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [SaleCreateRequestTipoVencimientoEnumTypeTransformer] instance.
  static SaleCreateRequestTipoVencimientoEnumTypeTransformer? _instance;
}


