//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardProductoMasVendido {
  /// Returns a new [DashboardProductoMasVendido] instance.
  DashboardProductoMasVendido({
    this.id,
    this.nombre,
    this.categoria,
    this.ventas,
    this.ingresos,
    this.stock,
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
  String? categoria;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ventas;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ingresos;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? stock;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardProductoMasVendido &&
    other.id == id &&
    other.nombre == nombre &&
    other.categoria == categoria &&
    other.ventas == ventas &&
    other.ingresos == ingresos &&
    other.stock == stock;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id == null ? 0 : id!.hashCode) +
    (nombre == null ? 0 : nombre!.hashCode) +
    (categoria == null ? 0 : categoria!.hashCode) +
    (ventas == null ? 0 : ventas!.hashCode) +
    (ingresos == null ? 0 : ingresos!.hashCode) +
    (stock == null ? 0 : stock!.hashCode);

  @override
  String toString() => 'DashboardProductoMasVendido[id=$id, nombre=$nombre, categoria=$categoria, ventas=$ventas, ingresos=$ingresos, stock=$stock]';

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
    if (this.categoria != null) {
      json[r'categoria'] = this.categoria;
    } else {
      json[r'categoria'] = null;
    }
    if (this.ventas != null) {
      json[r'ventas'] = this.ventas;
    } else {
      json[r'ventas'] = null;
    }
    if (this.ingresos != null) {
      json[r'ingresos'] = this.ingresos;
    } else {
      json[r'ingresos'] = null;
    }
    if (this.stock != null) {
      json[r'stock'] = this.stock;
    } else {
      json[r'stock'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardProductoMasVendido] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardProductoMasVendido? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardProductoMasVendido[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardProductoMasVendido[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardProductoMasVendido(
        id: mapValueOfType<String>(json, r'id'),
        nombre: mapValueOfType<String>(json, r'nombre'),
        categoria: mapValueOfType<String>(json, r'categoria'),
        ventas: num.parse('${json[r'ventas']}'),
        ingresos: num.parse('${json[r'ingresos']}'),
        stock: num.parse('${json[r'stock']}'),
      );
    }
    return null;
  }

  static List<DashboardProductoMasVendido> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardProductoMasVendido>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardProductoMasVendido.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardProductoMasVendido> mapFromJson(dynamic json) {
    final map = <String, DashboardProductoMasVendido>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardProductoMasVendido.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardProductoMasVendido-objects as value to a dart map
  static Map<String, List<DashboardProductoMasVendido>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardProductoMasVendido>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardProductoMasVendido.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

