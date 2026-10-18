//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PrecioListaItem {
  /// Returns a new [PrecioListaItem] instance.
  PrecioListaItem({
    required this.productoId,
    this.productoNombre,
    required this.precio,
  });

  /// 
  String productoId;

  /// 
  String? productoNombre;

  /// 
  num precio;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PrecioListaItem &&
    other.productoId == productoId &&
    other.productoNombre == productoNombre &&
    other.precio == precio;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (productoId.hashCode) +
    (productoNombre == null ? 0 : productoNombre!.hashCode) +
    (precio.hashCode);

  @override
  String toString() => 'PrecioListaItem[productoId=$productoId, productoNombre=$productoNombre, precio=$precio]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'productoId'] = this.productoId;
    if (this.productoNombre != null) {
      json[r'productoNombre'] = this.productoNombre;
    } else {
      json[r'productoNombre'] = null;
    }
      json[r'precio'] = this.precio;
    return json;
  }

  /// Returns a new [PrecioListaItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PrecioListaItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PrecioListaItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PrecioListaItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PrecioListaItem(
        productoId: mapValueOfType<String>(json, r'productoId')!,
        productoNombre: mapValueOfType<String>(json, r'productoNombre'),
        precio: num.parse('${json[r'precio']}'),
      );
    }
    return null;
  }

  static List<PrecioListaItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PrecioListaItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PrecioListaItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PrecioListaItem> mapFromJson(dynamic json) {
    final map = <String, PrecioListaItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PrecioListaItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PrecioListaItem-objects as value to a dart map
  static Map<String, List<PrecioListaItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PrecioListaItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PrecioListaItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'productoId',
    'precio',
  };
}

