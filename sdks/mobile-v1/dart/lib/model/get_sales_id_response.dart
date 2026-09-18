//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetSalesIdResponse {
  /// Returns a new [GetSalesIdResponse] instance.
  GetSalesIdResponse({
    this.ventaId,
    this.puntoDeVentaId,
    this.clienteId,
    this.empleadoId,
    this.subtotal,
    this.descuento,
    this.total,
    this.observaciones,
    this.items = const [],
    this.createdAt,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? ventaId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? puntoDeVentaId;

  String? clienteId;

  String? empleadoId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? subtotal;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? descuento;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? total;

  String? observaciones;

  List<SaleItem> items;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetSalesIdResponse &&
    other.ventaId == ventaId &&
    other.puntoDeVentaId == puntoDeVentaId &&
    other.clienteId == clienteId &&
    other.empleadoId == empleadoId &&
    other.subtotal == subtotal &&
    other.descuento == descuento &&
    other.total == total &&
    other.observaciones == observaciones &&
    _deepEquality.equals(other.items, items) &&
    other.createdAt == createdAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ventaId == null ? 0 : ventaId!.hashCode) +
    (puntoDeVentaId == null ? 0 : puntoDeVentaId!.hashCode) +
    (clienteId == null ? 0 : clienteId!.hashCode) +
    (empleadoId == null ? 0 : empleadoId!.hashCode) +
    (subtotal == null ? 0 : subtotal!.hashCode) +
    (descuento == null ? 0 : descuento!.hashCode) +
    (total == null ? 0 : total!.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode) +
    (items.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode);

  @override
  String toString() => 'GetSalesIdResponse[ventaId=$ventaId, puntoDeVentaId=$puntoDeVentaId, clienteId=$clienteId, empleadoId=$empleadoId, subtotal=$subtotal, descuento=$descuento, total=$total, observaciones=$observaciones, items=$items, createdAt=$createdAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.ventaId != null) {
      json[r'ventaId'] = this.ventaId;
    } else {
      json[r'ventaId'] = null;
    }
    if (this.puntoDeVentaId != null) {
      json[r'puntoDeVentaId'] = this.puntoDeVentaId;
    } else {
      json[r'puntoDeVentaId'] = null;
    }
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
    if (this.subtotal != null) {
      json[r'subtotal'] = this.subtotal;
    } else {
      json[r'subtotal'] = null;
    }
    if (this.descuento != null) {
      json[r'descuento'] = this.descuento;
    } else {
      json[r'descuento'] = null;
    }
    if (this.total != null) {
      json[r'total'] = this.total;
    } else {
      json[r'total'] = null;
    }
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
      json[r'items'] = this.items;
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    return json;
  }

  /// Returns a new [GetSalesIdResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetSalesIdResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetSalesIdResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetSalesIdResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetSalesIdResponse(
        ventaId: mapValueOfType<String>(json, r'ventaId'),
        puntoDeVentaId: mapValueOfType<String>(json, r'puntoDeVentaId'),
        clienteId: mapValueOfType<String>(json, r'clienteId'),
        empleadoId: mapValueOfType<String>(json, r'empleadoId'),
        subtotal: num.parse('${json[r'subtotal']}'),
        descuento: num.parse('${json[r'descuento']}'),
        total: num.parse('${json[r'total']}'),
        observaciones: mapValueOfType<String>(json, r'observaciones'),
        items: SaleItem.listFromJson(json[r'items']),
        createdAt: mapDateTime(json, r'createdAt', r''),
      );
    }
    return null;
  }

  static List<GetSalesIdResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetSalesIdResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetSalesIdResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetSalesIdResponse> mapFromJson(dynamic json) {
    final map = <String, GetSalesIdResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetSalesIdResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetSalesIdResponse-objects as value to a dart map
  static Map<String, List<GetSalesIdResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetSalesIdResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetSalesIdResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

