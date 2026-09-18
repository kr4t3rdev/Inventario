//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAccountingLogsResponse {
  /// Returns a new [GetAccountingLogsResponse] instance.
  GetAccountingLogsResponse({
    this.items = const [],
    required this.pagination,
  });

  List<AuditLog> items;

  Pagination pagination;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAccountingLogsResponse &&
    _deepEquality.equals(other.items, items) &&
    other.pagination == pagination;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (items.hashCode) +
    (pagination.hashCode);

  @override
  String toString() => 'GetAccountingLogsResponse[items=$items, pagination=$pagination]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'items'] = this.items;
      json[r'pagination'] = this.pagination;
    return json;
  }

  /// Returns a new [GetAccountingLogsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAccountingLogsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAccountingLogsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAccountingLogsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAccountingLogsResponse(
        items: AuditLog.listFromJson(json[r'items']),
        pagination: Pagination.fromJson(json[r'pagination'])!,
      );
    }
    return null;
  }

  static List<GetAccountingLogsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAccountingLogsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAccountingLogsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAccountingLogsResponse> mapFromJson(dynamic json) {
    final map = <String, GetAccountingLogsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAccountingLogsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAccountingLogsResponse-objects as value to a dart map
  static Map<String, List<GetAccountingLogsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAccountingLogsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAccountingLogsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'items',
    'pagination',
  };
}

