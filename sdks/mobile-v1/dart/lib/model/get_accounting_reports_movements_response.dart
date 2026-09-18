//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAccountingReportsMovementsResponse {
  /// Returns a new [GetAccountingReportsMovementsResponse] instance.
  GetAccountingReportsMovementsResponse({
    this.items = const [],
    required this.totales,
    required this.pagination,
    required this.filtros,
    required this.exportContent,
  });

  List<ReportResult> items;

  ReportTotals totales;

  Pagination pagination;

  ReportFilters filtros;

  /// Contenido CSV cuando se solicita exportación; nulo en consultas JSON normales.
  String? exportContent;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAccountingReportsMovementsResponse &&
    _deepEquality.equals(other.items, items) &&
    other.totales == totales &&
    other.pagination == pagination &&
    other.filtros == filtros &&
    other.exportContent == exportContent;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (items.hashCode) +
    (totales.hashCode) +
    (pagination.hashCode) +
    (filtros.hashCode) +
    (exportContent == null ? 0 : exportContent!.hashCode);

  @override
  String toString() => 'GetAccountingReportsMovementsResponse[items=$items, totales=$totales, pagination=$pagination, filtros=$filtros, exportContent=$exportContent]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'items'] = this.items;
      json[r'totales'] = this.totales;
      json[r'pagination'] = this.pagination;
      json[r'filtros'] = this.filtros;
    if (this.exportContent != null) {
      json[r'exportContent'] = this.exportContent;
    } else {
      json[r'exportContent'] = null;
    }
    return json;
  }

  /// Returns a new [GetAccountingReportsMovementsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAccountingReportsMovementsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAccountingReportsMovementsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAccountingReportsMovementsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAccountingReportsMovementsResponse(
        items: ReportResult.listFromJson(json[r'items']),
        totales: ReportTotals.fromJson(json[r'totales'])!,
        pagination: Pagination.fromJson(json[r'pagination'])!,
        filtros: ReportFilters.fromJson(json[r'filtros'])!,
        exportContent: mapValueOfType<String>(json, r'exportContent'),
      );
    }
    return null;
  }

  static List<GetAccountingReportsMovementsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAccountingReportsMovementsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAccountingReportsMovementsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAccountingReportsMovementsResponse> mapFromJson(dynamic json) {
    final map = <String, GetAccountingReportsMovementsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAccountingReportsMovementsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAccountingReportsMovementsResponse-objects as value to a dart map
  static Map<String, List<GetAccountingReportsMovementsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAccountingReportsMovementsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAccountingReportsMovementsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'items',
    'totales',
    'pagination',
    'filtros',
    'exportContent',
  };
}

