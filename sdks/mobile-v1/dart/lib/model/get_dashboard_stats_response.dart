//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetDashboardStatsResponse {
  /// Returns a new [GetDashboardStatsResponse] instance.
  GetDashboardStatsResponse({
    this.totalProductos,
    this.totalAlmacenes,
    this.totalPuntosVenta,
    this.totalVentas,
    this.totalMermas,
    this.totalTransferencias,
    this.totalIngresos,
    this.totalGastosMermas,
    this.totalGastos,
    this.totalBeneficio,
    this.valorTotalInventario,
    this.datosPorMes = const [],
    this.datosPorSemana = const [],
    this.ventasDiarias,
    this.productosMasVendidos = const [],
    this.productosStockBajo = const [],
    this.distribucionStock = const [],
    this.transferenciasStats,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalProductos;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalAlmacenes;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalPuntosVenta;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalVentas;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalMermas;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalTransferencias;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalIngresos;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalGastosMermas;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalGastos;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalBeneficio;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? valorTotalInventario;

  List<DashboardDatosPorMes> datosPorMes;

  List<DashboardDatosPorSemana> datosPorSemana;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DashboardVentasDiarias? ventasDiarias;

  List<DashboardProductoMasVendido> productosMasVendidos;

  List<DashboardProductoStockBajo> productosStockBajo;

  List<DashboardDistribucionStockItem> distribucionStock;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DashboardTransferenciasStats? transferenciasStats;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetDashboardStatsResponse &&
    other.totalProductos == totalProductos &&
    other.totalAlmacenes == totalAlmacenes &&
    other.totalPuntosVenta == totalPuntosVenta &&
    other.totalVentas == totalVentas &&
    other.totalMermas == totalMermas &&
    other.totalTransferencias == totalTransferencias &&
    other.totalIngresos == totalIngresos &&
    other.totalGastosMermas == totalGastosMermas &&
    other.totalGastos == totalGastos &&
    other.totalBeneficio == totalBeneficio &&
    other.valorTotalInventario == valorTotalInventario &&
    _deepEquality.equals(other.datosPorMes, datosPorMes) &&
    _deepEquality.equals(other.datosPorSemana, datosPorSemana) &&
    other.ventasDiarias == ventasDiarias &&
    _deepEquality.equals(other.productosMasVendidos, productosMasVendidos) &&
    _deepEquality.equals(other.productosStockBajo, productosStockBajo) &&
    _deepEquality.equals(other.distribucionStock, distribucionStock) &&
    other.transferenciasStats == transferenciasStats;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (totalProductos == null ? 0 : totalProductos!.hashCode) +
    (totalAlmacenes == null ? 0 : totalAlmacenes!.hashCode) +
    (totalPuntosVenta == null ? 0 : totalPuntosVenta!.hashCode) +
    (totalVentas == null ? 0 : totalVentas!.hashCode) +
    (totalMermas == null ? 0 : totalMermas!.hashCode) +
    (totalTransferencias == null ? 0 : totalTransferencias!.hashCode) +
    (totalIngresos == null ? 0 : totalIngresos!.hashCode) +
    (totalGastosMermas == null ? 0 : totalGastosMermas!.hashCode) +
    (totalGastos == null ? 0 : totalGastos!.hashCode) +
    (totalBeneficio == null ? 0 : totalBeneficio!.hashCode) +
    (valorTotalInventario == null ? 0 : valorTotalInventario!.hashCode) +
    (datosPorMes.hashCode) +
    (datosPorSemana.hashCode) +
    (ventasDiarias == null ? 0 : ventasDiarias!.hashCode) +
    (productosMasVendidos.hashCode) +
    (productosStockBajo.hashCode) +
    (distribucionStock.hashCode) +
    (transferenciasStats == null ? 0 : transferenciasStats!.hashCode);

  @override
  String toString() => 'GetDashboardStatsResponse[totalProductos=$totalProductos, totalAlmacenes=$totalAlmacenes, totalPuntosVenta=$totalPuntosVenta, totalVentas=$totalVentas, totalMermas=$totalMermas, totalTransferencias=$totalTransferencias, totalIngresos=$totalIngresos, totalGastosMermas=$totalGastosMermas, totalGastos=$totalGastos, totalBeneficio=$totalBeneficio, valorTotalInventario=$valorTotalInventario, datosPorMes=$datosPorMes, datosPorSemana=$datosPorSemana, ventasDiarias=$ventasDiarias, productosMasVendidos=$productosMasVendidos, productosStockBajo=$productosStockBajo, distribucionStock=$distribucionStock, transferenciasStats=$transferenciasStats]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.totalProductos != null) {
      json[r'totalProductos'] = this.totalProductos;
    } else {
      json[r'totalProductos'] = null;
    }
    if (this.totalAlmacenes != null) {
      json[r'totalAlmacenes'] = this.totalAlmacenes;
    } else {
      json[r'totalAlmacenes'] = null;
    }
    if (this.totalPuntosVenta != null) {
      json[r'totalPuntosVenta'] = this.totalPuntosVenta;
    } else {
      json[r'totalPuntosVenta'] = null;
    }
    if (this.totalVentas != null) {
      json[r'totalVentas'] = this.totalVentas;
    } else {
      json[r'totalVentas'] = null;
    }
    if (this.totalMermas != null) {
      json[r'totalMermas'] = this.totalMermas;
    } else {
      json[r'totalMermas'] = null;
    }
    if (this.totalTransferencias != null) {
      json[r'totalTransferencias'] = this.totalTransferencias;
    } else {
      json[r'totalTransferencias'] = null;
    }
    if (this.totalIngresos != null) {
      json[r'totalIngresos'] = this.totalIngresos;
    } else {
      json[r'totalIngresos'] = null;
    }
    if (this.totalGastosMermas != null) {
      json[r'totalGastosMermas'] = this.totalGastosMermas;
    } else {
      json[r'totalGastosMermas'] = null;
    }
    if (this.totalGastos != null) {
      json[r'totalGastos'] = this.totalGastos;
    } else {
      json[r'totalGastos'] = null;
    }
    if (this.totalBeneficio != null) {
      json[r'totalBeneficio'] = this.totalBeneficio;
    } else {
      json[r'totalBeneficio'] = null;
    }
    if (this.valorTotalInventario != null) {
      json[r'valorTotalInventario'] = this.valorTotalInventario;
    } else {
      json[r'valorTotalInventario'] = null;
    }
      json[r'datosPorMes'] = this.datosPorMes;
      json[r'datosPorSemana'] = this.datosPorSemana;
    if (this.ventasDiarias != null) {
      json[r'ventasDiarias'] = this.ventasDiarias;
    } else {
      json[r'ventasDiarias'] = null;
    }
      json[r'productosMasVendidos'] = this.productosMasVendidos;
      json[r'productosStockBajo'] = this.productosStockBajo;
      json[r'distribucionStock'] = this.distribucionStock;
    if (this.transferenciasStats != null) {
      json[r'transferenciasStats'] = this.transferenciasStats;
    } else {
      json[r'transferenciasStats'] = null;
    }
    return json;
  }

  /// Returns a new [GetDashboardStatsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetDashboardStatsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetDashboardStatsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetDashboardStatsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetDashboardStatsResponse(
        totalProductos: num.parse('${json[r'totalProductos']}'),
        totalAlmacenes: num.parse('${json[r'totalAlmacenes']}'),
        totalPuntosVenta: num.parse('${json[r'totalPuntosVenta']}'),
        totalVentas: num.parse('${json[r'totalVentas']}'),
        totalMermas: num.parse('${json[r'totalMermas']}'),
        totalTransferencias: num.parse('${json[r'totalTransferencias']}'),
        totalIngresos: num.parse('${json[r'totalIngresos']}'),
        totalGastosMermas: num.parse('${json[r'totalGastosMermas']}'),
        totalGastos: num.parse('${json[r'totalGastos']}'),
        totalBeneficio: num.parse('${json[r'totalBeneficio']}'),
        valorTotalInventario: num.parse('${json[r'valorTotalInventario']}'),
        datosPorMes: DashboardDatosPorMes.listFromJson(json[r'datosPorMes']),
        datosPorSemana: DashboardDatosPorSemana.listFromJson(json[r'datosPorSemana']),
        ventasDiarias: DashboardVentasDiarias.fromJson(json[r'ventasDiarias']),
        productosMasVendidos: DashboardProductoMasVendido.listFromJson(json[r'productosMasVendidos']),
        productosStockBajo: DashboardProductoStockBajo.listFromJson(json[r'productosStockBajo']),
        distribucionStock: DashboardDistribucionStockItem.listFromJson(json[r'distribucionStock']),
        transferenciasStats: DashboardTransferenciasStats.fromJson(json[r'transferenciasStats']),
      );
    }
    return null;
  }

  static List<GetDashboardStatsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetDashboardStatsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetDashboardStatsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetDashboardStatsResponse> mapFromJson(dynamic json) {
    final map = <String, GetDashboardStatsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetDashboardStatsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetDashboardStatsResponse-objects as value to a dart map
  static Map<String, List<GetDashboardStatsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetDashboardStatsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetDashboardStatsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

