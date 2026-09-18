//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class SaleItemRequest {
  /// Returns a new [SaleItemRequest] instance.
  SaleItemRequest({
    required this.productoId,
    required this.cantidad,
    required this.precioUnitario,
  });

  String productoId;

  /// Minimum value: 1
  int cantidad;

  /// Minimum value: 0
  int precioUnitario;

  @override
  bool operator ==(Object other) => identical(this, other) || other is SaleItemRequest &&
    other.productoId == productoId &&
    other.cantidad == cantidad &&
    other.precioUnitario == precioUnitario;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (productoId.hashCode) +
    (cantidad.hashCode) +
    (precioUnitario.hashCode);

  @override
  String toString() => 'SaleItemRequest[productoId=$productoId, cantidad=$cantidad, precioUnitario=$precioUnitario]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'productoId'] = this.productoId;
      json[r'cantidad'] = this.cantidad;
      json[r'precioUnitario'] = this.precioUnitario;
    return json;
  }

  /// Returns a new [SaleItemRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static SaleItemRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "SaleItemRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "SaleItemRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return SaleItemRequest(
        productoId: mapValueOfType<String>(json, r'productoId')!,
        cantidad: mapValueOfType<int>(json, r'cantidad')!,
        precioUnitario: mapValueOfType<int>(json, r'precioUnitario')!,
      );
    }
    return null;
  }

  static List<SaleItemRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <SaleItemRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = SaleItemRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, SaleItemRequest> mapFromJson(dynamic json) {
    final map = <String, SaleItemRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = SaleItemRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of SaleItemRequest-objects as value to a dart map
  static Map<String, List<SaleItemRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<SaleItemRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = SaleItemRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'productoId',
    'cantidad',
    'precioUnitario',
  };
}

