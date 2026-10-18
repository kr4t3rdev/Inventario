//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardLowStockItem {
  /// Returns a new [DashboardLowStockItem] instance.
  DashboardLowStockItem({
    this.id,
    this.nombre,
    this.stock,
    this.minimo,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? id;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? nombre;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? stock;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? minimo;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardLowStockItem &&
    other.id == id &&
    other.nombre == nombre &&
    other.stock == stock &&
    other.minimo == minimo;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id == null ? 0 : id!.hashCode) +
    (nombre == null ? 0 : nombre!.hashCode) +
    (stock == null ? 0 : stock!.hashCode) +
    (minimo == null ? 0 : minimo!.hashCode);

  @override
  String toString() => 'DashboardLowStockItem[id=$id, nombre=$nombre, stock=$stock, minimo=$minimo]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.id != null) {
      json[r'id'] = this.id;
    } else {
      json[r'id'] = null;
    }
    if (this.nombre != null) {
      json[r'nombre'] = this.nombre;
    } else {
      json[r'nombre'] = null;
    }
    if (this.stock != null) {
      json[r'stock'] = this.stock;
    } else {
      json[r'stock'] = null;
    }
    if (this.minimo != null) {
      json[r'minimo'] = this.minimo;
    } else {
      json[r'minimo'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardLowStockItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardLowStockItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardLowStockItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardLowStockItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardLowStockItem(
        id: mapValueOfType<String>(json, r'id'),
        nombre: mapValueOfType<String>(json, r'nombre'),
        stock: num.parse('${json[r'stock']}'),
        minimo: num.parse('${json[r'minimo']}'),
      );
    }
    return null;
  }

  static List<DashboardLowStockItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardLowStockItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardLowStockItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardLowStockItem> mapFromJson(dynamic json) {
    final map = <String, DashboardLowStockItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardLowStockItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardLowStockItem-objects as value to a dart map
  static Map<String, List<DashboardLowStockItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardLowStockItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardLowStockItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

