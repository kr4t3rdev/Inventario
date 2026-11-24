//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class MobileSyncProduct {
  /// Returns a new [MobileSyncProduct] instance.
  MobileSyncProduct({
    required this.id,
    required this.nombre,
    required this.descripcion,
    required this.precioVenta,
    required this.stock,
    required this.stockMinimo,
    required this.codigoInterno,
    required this.codigoNegocio,
    required this.sku,
    required this.atributoJson,
    required this.esVariante,
    required this.plantillaId,
    required this.proveedorCodigo,
    required this.idSeccionCodigo,
    required this.especificoCodigo,
    required this.surtidoCodigo,
    required this.dcCodigo,
    required this.categoriaId,
    required this.subcategoriaId,
    required this.unidadId,
    required this.vendorId,
    required this.almacenId,
    required this.puntoDeVentaId,
    this.fotos = const [],
    required this.esCompuesto,
    required this.createdAt,
    required this.updatedAt,
    required this.categoria,
    required this.subcategoria,
    required this.unidad,
    required this.vendor,
  });

  String id;

  String nombre;

  String? descripcion;

  int precioVenta;

  int stock;

  int stockMinimo;

  String? codigoInterno;

  String? codigoNegocio;

  String? sku;

  JsonValue? atributoJson;

  bool esVariante;

  String? plantillaId;

  String? proveedorCodigo;

  String? idSeccionCodigo;

  String? especificoCodigo;

  String? surtidoCodigo;

  String? dcCodigo;

  String categoriaId;

  String? subcategoriaId;

  String? unidadId;

  String? vendorId;

  String almacenId;

  String? puntoDeVentaId;

  List<String> fotos;

  bool esCompuesto;

  DateTime createdAt;

  DateTime updatedAt;

  MobileSyncProductCategoria categoria;

  MobileSyncProductSubcategoria subcategoria;

  MobileSyncProductUnidad unidad;

  MobileSyncProductVendor vendor;

  @override
  bool operator ==(Object other) => identical(this, other) || other is MobileSyncProduct &&
    other.id == id &&
    other.nombre == nombre &&
    other.descripcion == descripcion &&
    other.precioVenta == precioVenta &&
    other.stock == stock &&
    other.stockMinimo == stockMinimo &&
    other.codigoInterno == codigoInterno &&
    other.codigoNegocio == codigoNegocio &&
    other.sku == sku &&
    other.atributoJson == atributoJson &&
    other.esVariante == esVariante &&
    other.plantillaId == plantillaId &&
    other.proveedorCodigo == proveedorCodigo &&
    other.idSeccionCodigo == idSeccionCodigo &&
    other.especificoCodigo == especificoCodigo &&
    other.surtidoCodigo == surtidoCodigo &&
    other.dcCodigo == dcCodigo &&
    other.categoriaId == categoriaId &&
    other.subcategoriaId == subcategoriaId &&
    other.unidadId == unidadId &&
    other.vendorId == vendorId &&
    other.almacenId == almacenId &&
    other.puntoDeVentaId == puntoDeVentaId &&
    _deepEquality.equals(other.fotos, fotos) &&
    other.esCompuesto == esCompuesto &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt &&
    other.categoria == categoria &&
    other.subcategoria == subcategoria &&
    other.unidad == unidad &&
    other.vendor == vendor;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id.hashCode) +
    (nombre.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode) +
    (precioVenta.hashCode) +
    (stock.hashCode) +
    (stockMinimo.hashCode) +
    (codigoInterno == null ? 0 : codigoInterno!.hashCode) +
    (codigoNegocio == null ? 0 : codigoNegocio!.hashCode) +
    (sku == null ? 0 : sku!.hashCode) +
    (atributoJson == null ? 0 : atributoJson!.hashCode) +
    (esVariante.hashCode) +
    (plantillaId == null ? 0 : plantillaId!.hashCode) +
    (proveedorCodigo == null ? 0 : proveedorCodigo!.hashCode) +
    (idSeccionCodigo == null ? 0 : idSeccionCodigo!.hashCode) +
    (especificoCodigo == null ? 0 : especificoCodigo!.hashCode) +
    (surtidoCodigo == null ? 0 : surtidoCodigo!.hashCode) +
    (dcCodigo == null ? 0 : dcCodigo!.hashCode) +
    (categoriaId.hashCode) +
    (subcategoriaId == null ? 0 : subcategoriaId!.hashCode) +
    (unidadId == null ? 0 : unidadId!.hashCode) +
    (vendorId == null ? 0 : vendorId!.hashCode) +
    (almacenId.hashCode) +
    (puntoDeVentaId == null ? 0 : puntoDeVentaId!.hashCode) +
    (fotos.hashCode) +
    (esCompuesto.hashCode) +
    (createdAt.hashCode) +
    (updatedAt.hashCode) +
    (categoria.hashCode) +
    (subcategoria.hashCode) +
    (unidad.hashCode) +
    (vendor.hashCode);

  @override
  String toString() => 'MobileSyncProduct[id=$id, nombre=$nombre, descripcion=$descripcion, precioVenta=$precioVenta, stock=$stock, stockMinimo=$stockMinimo, codigoInterno=$codigoInterno, codigoNegocio=$codigoNegocio, sku=$sku, atributoJson=$atributoJson, esVariante=$esVariante, plantillaId=$plantillaId, proveedorCodigo=$proveedorCodigo, idSeccionCodigo=$idSeccionCodigo, especificoCodigo=$especificoCodigo, surtidoCodigo=$surtidoCodigo, dcCodigo=$dcCodigo, categoriaId=$categoriaId, subcategoriaId=$subcategoriaId, unidadId=$unidadId, vendorId=$vendorId, almacenId=$almacenId, puntoDeVentaId=$puntoDeVentaId, fotos=$fotos, esCompuesto=$esCompuesto, createdAt=$createdAt, updatedAt=$updatedAt, categoria=$categoria, subcategoria=$subcategoria, unidad=$unidad, vendor=$vendor]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'id'] = this.id;
      json[r'nombre'] = this.nombre;
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
      json[r'precioVenta'] = this.precioVenta;
      json[r'stock'] = this.stock;
      json[r'stockMinimo'] = this.stockMinimo;
    if (this.codigoInterno != null) {
      json[r'codigoInterno'] = this.codigoInterno;
    } else {
      json[r'codigoInterno'] = null;
    }
    if (this.codigoNegocio != null) {
      json[r'codigoNegocio'] = this.codigoNegocio;
    } else {
      json[r'codigoNegocio'] = null;
    }
    if (this.sku != null) {
      json[r'sku'] = this.sku;
    } else {
      json[r'sku'] = null;
    }
    if (this.atributoJson != null) {
      json[r'atributoJson'] = this.atributoJson;
    } else {
      json[r'atributoJson'] = null;
    }
      json[r'esVariante'] = this.esVariante;
    if (this.plantillaId != null) {
      json[r'plantillaId'] = this.plantillaId;
    } else {
      json[r'plantillaId'] = null;
    }
    if (this.proveedorCodigo != null) {
      json[r'proveedorCodigo'] = this.proveedorCodigo;
    } else {
      json[r'proveedorCodigo'] = null;
    }
    if (this.idSeccionCodigo != null) {
      json[r'idSeccionCodigo'] = this.idSeccionCodigo;
    } else {
      json[r'idSeccionCodigo'] = null;
    }
    if (this.especificoCodigo != null) {
      json[r'especificoCodigo'] = this.especificoCodigo;
    } else {
      json[r'especificoCodigo'] = null;
    }
    if (this.surtidoCodigo != null) {
      json[r'surtidoCodigo'] = this.surtidoCodigo;
    } else {
      json[r'surtidoCodigo'] = null;
    }
    if (this.dcCodigo != null) {
      json[r'dcCodigo'] = this.dcCodigo;
    } else {
      json[r'dcCodigo'] = null;
    }
      json[r'categoriaId'] = this.categoriaId;
    if (this.subcategoriaId != null) {
      json[r'subcategoriaId'] = this.subcategoriaId;
    } else {
      json[r'subcategoriaId'] = null;
    }
    if (this.unidadId != null) {
      json[r'unidadId'] = this.unidadId;
    } else {
      json[r'unidadId'] = null;
    }
    if (this.vendorId != null) {
      json[r'vendorId'] = this.vendorId;
    } else {
      json[r'vendorId'] = null;
    }
      json[r'almacenId'] = this.almacenId;
    if (this.puntoDeVentaId != null) {
      json[r'puntoDeVentaId'] = this.puntoDeVentaId;
    } else {
      json[r'puntoDeVentaId'] = null;
    }
      json[r'fotos'] = this.fotos;
      json[r'esCompuesto'] = this.esCompuesto;
      json[r'createdAt'] = this.createdAt.toUtc().toIso8601String();
      json[r'updatedAt'] = this.updatedAt.toUtc().toIso8601String();
      json[r'categoria'] = this.categoria;
      json[r'subcategoria'] = this.subcategoria;
      json[r'unidad'] = this.unidad;
      json[r'vendor'] = this.vendor;
    return json;
  }

  /// Returns a new [MobileSyncProduct] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static MobileSyncProduct? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "MobileSyncProduct[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "MobileSyncProduct[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return MobileSyncProduct(
        id: mapValueOfType<String>(json, r'id')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        descripcion: mapValueOfType<String>(json, r'descripcion'),
        precioVenta: mapValueOfType<int>(json, r'precioVenta')!,
        stock: mapValueOfType<int>(json, r'stock')!,
        stockMinimo: mapValueOfType<int>(json, r'stockMinimo')!,
        codigoInterno: mapValueOfType<String>(json, r'codigoInterno'),
        codigoNegocio: mapValueOfType<String>(json, r'codigoNegocio'),
        sku: mapValueOfType<String>(json, r'sku'),
        atributoJson: JsonValue.fromJson(json[r'atributoJson']),
        esVariante: mapValueOfType<bool>(json, r'esVariante')!,
        plantillaId: mapValueOfType<String>(json, r'plantillaId'),
        proveedorCodigo: mapValueOfType<String>(json, r'proveedorCodigo'),
        idSeccionCodigo: mapValueOfType<String>(json, r'idSeccionCodigo'),
        especificoCodigo: mapValueOfType<String>(json, r'especificoCodigo'),
        surtidoCodigo: mapValueOfType<String>(json, r'surtidoCodigo'),
        dcCodigo: mapValueOfType<String>(json, r'dcCodigo'),
        categoriaId: mapValueOfType<String>(json, r'categoriaId')!,
        subcategoriaId: mapValueOfType<String>(json, r'subcategoriaId'),
        unidadId: mapValueOfType<String>(json, r'unidadId'),
        vendorId: mapValueOfType<String>(json, r'vendorId'),
        almacenId: mapValueOfType<String>(json, r'almacenId')!,
        puntoDeVentaId: mapValueOfType<String>(json, r'puntoDeVentaId'),
        fotos: json[r'fotos'] is Iterable
            ? (json[r'fotos'] as Iterable).cast<String>().toList(growable: false)
            : const [],
        esCompuesto: mapValueOfType<bool>(json, r'esCompuesto')!,
        createdAt: mapDateTime(json, r'createdAt', r'')!,
        updatedAt: mapDateTime(json, r'updatedAt', r'')!,
        categoria: MobileSyncProductCategoria.fromJson(json[r'categoria'])!,
        subcategoria: MobileSyncProductSubcategoria.fromJson(json[r'subcategoria'])!,
        unidad: MobileSyncProductUnidad.fromJson(json[r'unidad'])!,
        vendor: MobileSyncProductVendor.fromJson(json[r'vendor'])!,
      );
    }
    return null;
  }

  static List<MobileSyncProduct> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <MobileSyncProduct>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = MobileSyncProduct.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, MobileSyncProduct> mapFromJson(dynamic json) {
    final map = <String, MobileSyncProduct>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = MobileSyncProduct.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of MobileSyncProduct-objects as value to a dart map
  static Map<String, List<MobileSyncProduct>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<MobileSyncProduct>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = MobileSyncProduct.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'id',
    'nombre',
    'descripcion',
    'precioVenta',
    'stock',
    'stockMinimo',
    'codigoInterno',
    'codigoNegocio',
    'sku',
    'atributoJson',
    'esVariante',
    'plantillaId',
    'proveedorCodigo',
    'idSeccionCodigo',
    'especificoCodigo',
    'surtidoCodigo',
    'dcCodigo',
    'categoriaId',
    'subcategoriaId',
    'unidadId',
    'vendorId',
    'almacenId',
    'puntoDeVentaId',
    'fotos',
    'esCompuesto',
    'createdAt',
    'updatedAt',
    'categoria',
    'subcategoria',
    'unidad',
    'vendor',
  };
}

