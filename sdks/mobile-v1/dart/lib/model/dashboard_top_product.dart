//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardTopProduct {
  /// Returns a new [DashboardTopProduct] instance.
  DashboardTopProduct({
    this.id,
    this.nombre,
    this.cantidad,
    this.total,
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
  num? cantidad;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? total;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardTopProduct &&
    other.id == id &&
    other.nombre == nombre &&
    other.cantidad == cantidad &&
    other.total == total;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id == null ? 0 : id!.hashCode) +
    (nombre == null ? 0 : nombre!.hashCode) +
    (cantidad == null ? 0 : cantidad!.hashCode) +
    (total == null ? 0 : total!.hashCode);

  @override
  String toString() => 'DashboardTopProduct[id=$id, nombre=$nombre, cantidad=$cantidad, total=$total]';

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
    if (this.cantidad != null) {
      json[r'cantidad'] = this.cantidad;
    } else {
      json[r'cantidad'] = null;
    }
    if (this.total != null) {
      json[r'total'] = this.total;
    } else {
      json[r'total'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardTopProduct] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardTopProduct? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardTopProduct[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardTopProduct[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardTopProduct(
        id: mapValueOfType<String>(json, r'id'),
        nombre: mapValueOfType<String>(json, r'nombre'),
        cantidad: num.parse('${json[r'cantidad']}'),
        total: num.parse('${json[r'total']}'),
      );
    }
    return null;
  }

  static List<DashboardTopProduct> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardTopProduct>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardTopProduct.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardTopProduct> mapFromJson(dynamic json) {
    final map = <String, DashboardTopProduct>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardTopProduct.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardTopProduct-objects as value to a dart map
  static Map<String, List<DashboardTopProduct>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardTopProduct>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardTopProduct.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

