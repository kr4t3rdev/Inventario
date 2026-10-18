//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardDistribucionStockItem {
  /// Returns a new [DashboardDistribucionStockItem] instance.
  DashboardDistribucionStockItem({
    this.categoria,
    this.productos,
    this.stockTotal,
    this.valorTotal,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? categoria;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? productos;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? stockTotal;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? valorTotal;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardDistribucionStockItem &&
    other.categoria == categoria &&
    other.productos == productos &&
    other.stockTotal == stockTotal &&
    other.valorTotal == valorTotal;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (categoria == null ? 0 : categoria!.hashCode) +
    (productos == null ? 0 : productos!.hashCode) +
    (stockTotal == null ? 0 : stockTotal!.hashCode) +
    (valorTotal == null ? 0 : valorTotal!.hashCode);

  @override
  String toString() => 'DashboardDistribucionStockItem[categoria=$categoria, productos=$productos, stockTotal=$stockTotal, valorTotal=$valorTotal]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.categoria != null) {
      json[r'categoria'] = this.categoria;
    } else {
      json[r'categoria'] = null;
    }
    if (this.productos != null) {
      json[r'productos'] = this.productos;
    } else {
      json[r'productos'] = null;
    }
    if (this.stockTotal != null) {
      json[r'stockTotal'] = this.stockTotal;
    } else {
      json[r'stockTotal'] = null;
    }
    if (this.valorTotal != null) {
      json[r'valorTotal'] = this.valorTotal;
    } else {
      json[r'valorTotal'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardDistribucionStockItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardDistribucionStockItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardDistribucionStockItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardDistribucionStockItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardDistribucionStockItem(
        categoria: mapValueOfType<String>(json, r'categoria'),
        productos: num.parse('${json[r'productos']}'),
        stockTotal: num.parse('${json[r'stockTotal']}'),
        valorTotal: num.parse('${json[r'valorTotal']}'),
      );
    }
    return null;
  }

  static List<DashboardDistribucionStockItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardDistribucionStockItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardDistribucionStockItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardDistribucionStockItem> mapFromJson(dynamic json) {
    final map = <String, DashboardDistribucionStockItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardDistribucionStockItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardDistribucionStockItem-objects as value to a dart map
  static Map<String, List<DashboardDistribucionStockItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardDistribucionStockItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardDistribucionStockItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

