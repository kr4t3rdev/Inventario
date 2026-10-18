//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardProductoStockBajoUnidad {
  /// Returns a new [DashboardProductoStockBajoUnidad] instance.
  DashboardProductoStockBajoUnidad({
    this.simbolo,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? simbolo;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardProductoStockBajoUnidad &&
    other.simbolo == simbolo;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (simbolo == null ? 0 : simbolo!.hashCode);

  @override
  String toString() => 'DashboardProductoStockBajoUnidad[simbolo=$simbolo]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.simbolo != null) {
      json[r'simbolo'] = this.simbolo;
    } else {
      json[r'simbolo'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardProductoStockBajoUnidad] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardProductoStockBajoUnidad? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardProductoStockBajoUnidad[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardProductoStockBajoUnidad[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardProductoStockBajoUnidad(
        simbolo: mapValueOfType<String>(json, r'simbolo'),
      );
    }
    return null;
  }

  static List<DashboardProductoStockBajoUnidad> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardProductoStockBajoUnidad>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardProductoStockBajoUnidad.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardProductoStockBajoUnidad> mapFromJson(dynamic json) {
    final map = <String, DashboardProductoStockBajoUnidad>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardProductoStockBajoUnidad.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardProductoStockBajoUnidad-objects as value to a dart map
  static Map<String, List<DashboardProductoStockBajoUnidad>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardProductoStockBajoUnidad>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardProductoStockBajoUnidad.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

