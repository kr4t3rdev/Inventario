//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ReportResult {
  /// Returns a new [ReportResult] instance.
  ReportResult({
    this.items = const [],
    this.totales,
    this.estadisticas,
    this.pagination,
    this.filtros,
  });

  List<JsonValue> items;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  ReportTotals? totales;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  ReportStatistics? estadisticas;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  Pagination? pagination;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  ReportFilters? filtros;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ReportResult &&
    _deepEquality.equals(other.items, items) &&
    other.totales == totales &&
    other.estadisticas == estadisticas &&
    other.pagination == pagination &&
    other.filtros == filtros;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (items.hashCode) +
    (totales == null ? 0 : totales!.hashCode) +
    (estadisticas == null ? 0 : estadisticas!.hashCode) +
    (pagination == null ? 0 : pagination!.hashCode) +
    (filtros == null ? 0 : filtros!.hashCode);

  @override
  String toString() => 'ReportResult[items=$items, totales=$totales, estadisticas=$estadisticas, pagination=$pagination, filtros=$filtros]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'items'] = this.items;
    if (this.totales != null) {
      json[r'totales'] = this.totales;
    } else {
      json[r'totales'] = null;
    }
    if (this.estadisticas != null) {
      json[r'estadisticas'] = this.estadisticas;
    } else {
      json[r'estadisticas'] = null;
    }
    if (this.pagination != null) {
      json[r'pagination'] = this.pagination;
    } else {
      json[r'pagination'] = null;
    }
    if (this.filtros != null) {
      json[r'filtros'] = this.filtros;
    } else {
      json[r'filtros'] = null;
    }
    return json;
  }

  /// Returns a new [ReportResult] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ReportResult? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ReportResult[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ReportResult[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ReportResult(
        items: JsonValue.listFromJson(json[r'items']),
        totales: ReportTotals.fromJson(json[r'totales']),
        estadisticas: ReportStatistics.fromJson(json[r'estadisticas']),
        pagination: Pagination.fromJson(json[r'pagination']),
        filtros: ReportFilters.fromJson(json[r'filtros']),
      );
    }
    return null;
  }

  static List<ReportResult> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ReportResult>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ReportResult.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ReportResult> mapFromJson(dynamic json) {
    final map = <String, ReportResult>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ReportResult.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ReportResult-objects as value to a dart map
  static Map<String, List<ReportResult>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ReportResult>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ReportResult.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

