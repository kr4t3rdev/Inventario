//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardTransferenciasStats {
  /// Returns a new [DashboardTransferenciasStats] instance.
  DashboardTransferenciasStats({
    this.almacenAAlmacen,
    this.almacenAPuntoVenta,
    this.puntoVentaAAlmacen,
    this.puntoVentaAPuntoVenta,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? almacenAAlmacen;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? almacenAPuntoVenta;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? puntoVentaAAlmacen;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? puntoVentaAPuntoVenta;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardTransferenciasStats &&
    other.almacenAAlmacen == almacenAAlmacen &&
    other.almacenAPuntoVenta == almacenAPuntoVenta &&
    other.puntoVentaAAlmacen == puntoVentaAAlmacen &&
    other.puntoVentaAPuntoVenta == puntoVentaAPuntoVenta;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (almacenAAlmacen == null ? 0 : almacenAAlmacen!.hashCode) +
    (almacenAPuntoVenta == null ? 0 : almacenAPuntoVenta!.hashCode) +
    (puntoVentaAAlmacen == null ? 0 : puntoVentaAAlmacen!.hashCode) +
    (puntoVentaAPuntoVenta == null ? 0 : puntoVentaAPuntoVenta!.hashCode);

  @override
  String toString() => 'DashboardTransferenciasStats[almacenAAlmacen=$almacenAAlmacen, almacenAPuntoVenta=$almacenAPuntoVenta, puntoVentaAAlmacen=$puntoVentaAAlmacen, puntoVentaAPuntoVenta=$puntoVentaAPuntoVenta]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.almacenAAlmacen != null) {
      json[r'almacenAAlmacen'] = this.almacenAAlmacen;
    } else {
      json[r'almacenAAlmacen'] = null;
    }
    if (this.almacenAPuntoVenta != null) {
      json[r'almacenAPuntoVenta'] = this.almacenAPuntoVenta;
    } else {
      json[r'almacenAPuntoVenta'] = null;
    }
    if (this.puntoVentaAAlmacen != null) {
      json[r'puntoVentaAAlmacen'] = this.puntoVentaAAlmacen;
    } else {
      json[r'puntoVentaAAlmacen'] = null;
    }
    if (this.puntoVentaAPuntoVenta != null) {
      json[r'puntoVentaAPuntoVenta'] = this.puntoVentaAPuntoVenta;
    } else {
      json[r'puntoVentaAPuntoVenta'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardTransferenciasStats] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardTransferenciasStats? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardTransferenciasStats[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardTransferenciasStats[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardTransferenciasStats(
        almacenAAlmacen: num.parse('${json[r'almacenAAlmacen']}'),
        almacenAPuntoVenta: num.parse('${json[r'almacenAPuntoVenta']}'),
        puntoVentaAAlmacen: num.parse('${json[r'puntoVentaAAlmacen']}'),
        puntoVentaAPuntoVenta: num.parse('${json[r'puntoVentaAPuntoVenta']}'),
      );
    }
    return null;
  }

  static List<DashboardTransferenciasStats> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardTransferenciasStats>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardTransferenciasStats.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardTransferenciasStats> mapFromJson(dynamic json) {
    final map = <String, DashboardTransferenciasStats>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardTransferenciasStats.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardTransferenciasStats-objects as value to a dart map
  static Map<String, List<DashboardTransferenciasStats>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardTransferenciasStats>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardTransferenciasStats.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

