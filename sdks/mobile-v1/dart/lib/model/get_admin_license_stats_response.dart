//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAdminLicenseStatsResponse {
  /// Returns a new [GetAdminLicenseStatsResponse] instance.
  GetAdminLicenseStatsResponse({
    required this.total,
    required this.activas,
    required this.expiradas,
    required this.demos,
    required this.porVencer,
    required this.adminTest,
  });

  /// Minimum value: 0
  int total;

  /// Minimum value: 0
  int activas;

  /// Minimum value: 0
  int expiradas;

  /// Minimum value: 0
  int demos;

  /// Minimum value: 0
  int porVencer;

  /// Minimum value: 0
  int adminTest;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAdminLicenseStatsResponse &&
    other.total == total &&
    other.activas == activas &&
    other.expiradas == expiradas &&
    other.demos == demos &&
    other.porVencer == porVencer &&
    other.adminTest == adminTest;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (total.hashCode) +
    (activas.hashCode) +
    (expiradas.hashCode) +
    (demos.hashCode) +
    (porVencer.hashCode) +
    (adminTest.hashCode);

  @override
  String toString() => 'GetAdminLicenseStatsResponse[total=$total, activas=$activas, expiradas=$expiradas, demos=$demos, porVencer=$porVencer, adminTest=$adminTest]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'total'] = this.total;
      json[r'activas'] = this.activas;
      json[r'expiradas'] = this.expiradas;
      json[r'demos'] = this.demos;
      json[r'porVencer'] = this.porVencer;
      json[r'adminTest'] = this.adminTest;
    return json;
  }

  /// Returns a new [GetAdminLicenseStatsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAdminLicenseStatsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAdminLicenseStatsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAdminLicenseStatsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAdminLicenseStatsResponse(
        total: mapValueOfType<int>(json, r'total')!,
        activas: mapValueOfType<int>(json, r'activas')!,
        expiradas: mapValueOfType<int>(json, r'expiradas')!,
        demos: mapValueOfType<int>(json, r'demos')!,
        porVencer: mapValueOfType<int>(json, r'porVencer')!,
        adminTest: mapValueOfType<int>(json, r'adminTest')!,
      );
    }
    return null;
  }

  static List<GetAdminLicenseStatsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAdminLicenseStatsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAdminLicenseStatsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAdminLicenseStatsResponse> mapFromJson(dynamic json) {
    final map = <String, GetAdminLicenseStatsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAdminLicenseStatsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAdminLicenseStatsResponse-objects as value to a dart map
  static Map<String, List<GetAdminLicenseStatsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAdminLicenseStatsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAdminLicenseStatsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'total',
    'activas',
    'expiradas',
    'demos',
    'porVencer',
    'adminTest',
  };
}

