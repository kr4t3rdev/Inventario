//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardProductoStockBajo {
  /// Returns a new [DashboardProductoStockBajo] instance.
  DashboardProductoStockBajo({
    this.id,
    this.nombre,
    this.stock,
    this.stockMinimo,
    this.precioCosto,
    this.precioVenta,
    this.almacenId,
    this.puntoDeVentaId,
    this.categoria,
    this.unidad,
    this.stockTotal,
    this.diferencia,
    this.umbralUsado,
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
  num? stockMinimo;

  num? precioCosto;

  num? precioVenta;

  String? almacenId;

  String? puntoDeVentaId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DashboardProductoStockBajoCategoria? categoria;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DashboardProductoStockBajoUnidad? unidad;

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
  num? diferencia;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? umbralUsado;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardProductoStockBajo &&
    other.id == id &&
    other.nombre == nombre &&
    other.stock == stock &&
    other.stockMinimo == stockMinimo &&
    other.precioCosto == precioCosto &&
    other.precioVenta == precioVenta &&
    other.almacenId == almacenId &&
    other.puntoDeVentaId == puntoDeVentaId &&
    other.categoria == categoria &&
    other.unidad == unidad &&
    other.stockTotal == stockTotal &&
    other.diferencia == diferencia &&
    other.umbralUsado == umbralUsado;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id == null ? 0 : id!.hashCode) +
    (nombre == null ? 0 : nombre!.hashCode) +
    (stock == null ? 0 : stock!.hashCode) +
    (stockMinimo == null ? 0 : stockMinimo!.hashCode) +
    (precioCosto == null ? 0 : precioCosto!.hashCode) +
    (precioVenta == null ? 0 : precioVenta!.hashCode) +
    (almacenId == null ? 0 : almacenId!.hashCode) +
    (puntoDeVentaId == null ? 0 : puntoDeVentaId!.hashCode) +
    (categoria == null ? 0 : categoria!.hashCode) +
    (unidad == null ? 0 : unidad!.hashCode) +
    (stockTotal == null ? 0 : stockTotal!.hashCode) +
    (diferencia == null ? 0 : diferencia!.hashCode) +
    (umbralUsado == null ? 0 : umbralUsado!.hashCode);

  @override
  String toString() => 'DashboardProductoStockBajo[id=$id, nombre=$nombre, stock=$stock, stockMinimo=$stockMinimo, precioCosto=$precioCosto, precioVenta=$precioVenta, almacenId=$almacenId, puntoDeVentaId=$puntoDeVentaId, categoria=$categoria, unidad=$unidad, stockTotal=$stockTotal, diferencia=$diferencia, umbralUsado=$umbralUsado]';

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
    if (this.stockMinimo != null) {
      json[r'stockMinimo'] = this.stockMinimo;
    } else {
      json[r'stockMinimo'] = null;
    }
    if (this.precioCosto != null) {
      json[r'precioCosto'] = this.precioCosto;
    } else {
      json[r'precioCosto'] = null;
    }
    if (this.precioVenta != null) {
      json[r'precioVenta'] = this.precioVenta;
    } else {
      json[r'precioVenta'] = null;
    }
    if (this.almacenId != null) {
      json[r'almacenId'] = this.almacenId;
    } else {
      json[r'almacenId'] = null;
    }
    if (this.puntoDeVentaId != null) {
      json[r'puntoDeVentaId'] = this.puntoDeVentaId;
    } else {
      json[r'puntoDeVentaId'] = null;
    }
    if (this.categoria != null) {
      json[r'categoria'] = this.categoria;
    } else {
      json[r'categoria'] = null;
    }
    if (this.unidad != null) {
      json[r'unidad'] = this.unidad;
    } else {
      json[r'unidad'] = null;
    }
    if (this.stockTotal != null) {
      json[r'stockTotal'] = this.stockTotal;
    } else {
      json[r'stockTotal'] = null;
    }
    if (this.diferencia != null) {
      json[r'diferencia'] = this.diferencia;
    } else {
      json[r'diferencia'] = null;
    }
    if (this.umbralUsado != null) {
      json[r'umbralUsado'] = this.umbralUsado;
    } else {
      json[r'umbralUsado'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardProductoStockBajo] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardProductoStockBajo? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardProductoStockBajo[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardProductoStockBajo[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardProductoStockBajo(
        id: mapValueOfType<String>(json, r'id'),
        nombre: mapValueOfType<String>(json, r'nombre'),
        stock: num.parse('${json[r'stock']}'),
        stockMinimo: num.parse('${json[r'stockMinimo']}'),
        precioCosto: json[r'precioCosto'] == null
            ? null
            : num.parse('${json[r'precioCosto']}'),
        precioVenta: json[r'precioVenta'] == null
            ? null
            : num.parse('${json[r'precioVenta']}'),
        almacenId: mapValueOfType<String>(json, r'almacenId'),
        puntoDeVentaId: mapValueOfType<String>(json, r'puntoDeVentaId'),
        categoria: DashboardProductoStockBajoCategoria.fromJson(json[r'categoria']),
        unidad: DashboardProductoStockBajoUnidad.fromJson(json[r'unidad']),
        stockTotal: num.parse('${json[r'stockTotal']}'),
        diferencia: num.parse('${json[r'diferencia']}'),
        umbralUsado: num.parse('${json[r'umbralUsado']}'),
      );
    }
    return null;
  }

  static List<DashboardProductoStockBajo> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardProductoStockBajo>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardProductoStockBajo.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardProductoStockBajo> mapFromJson(dynamic json) {
    final map = <String, DashboardProductoStockBajo>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardProductoStockBajo.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardProductoStockBajo-objects as value to a dart map
  static Map<String, List<DashboardProductoStockBajo>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardProductoStockBajo>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardProductoStockBajo.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

