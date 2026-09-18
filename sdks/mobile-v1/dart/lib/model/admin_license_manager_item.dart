//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminLicenseManagerItem {
  /// Returns a new [AdminLicenseManagerItem] instance.
  AdminLicenseManagerItem({
    this.membershipId,
    this.tenantId,
    required this.tenantRole,
    required this.user,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? membershipId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? tenantId;

  String tenantRole;

  AdminUserLite user;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminLicenseManagerItem &&
    other.membershipId == membershipId &&
    other.tenantId == tenantId &&
    other.tenantRole == tenantRole &&
    other.user == user;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (membershipId == null ? 0 : membershipId!.hashCode) +
    (tenantId == null ? 0 : tenantId!.hashCode) +
    (tenantRole.hashCode) +
    (user.hashCode);

  @override
  String toString() => 'AdminLicenseManagerItem[membershipId=$membershipId, tenantId=$tenantId, tenantRole=$tenantRole, user=$user]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.membershipId != null) {
      json[r'membershipId'] = this.membershipId;
    } else {
      json[r'membershipId'] = null;
    }
    if (this.tenantId != null) {
      json[r'tenantId'] = this.tenantId;
    } else {
      json[r'tenantId'] = null;
    }
      json[r'tenantRole'] = this.tenantRole;
      json[r'user'] = this.user;
    return json;
  }

  /// Returns a new [AdminLicenseManagerItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminLicenseManagerItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminLicenseManagerItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminLicenseManagerItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminLicenseManagerItem(
        membershipId: mapValueOfType<String>(json, r'membershipId'),
        tenantId: mapValueOfType<String>(json, r'tenantId'),
        tenantRole: mapValueOfType<String>(json, r'tenantRole')!,
        user: AdminUserLite.fromJson(json[r'user'])!,
      );
    }
    return null;
  }

  static List<AdminLicenseManagerItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminLicenseManagerItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminLicenseManagerItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminLicenseManagerItem> mapFromJson(dynamic json) {
    final map = <String, AdminLicenseManagerItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminLicenseManagerItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminLicenseManagerItem-objects as value to a dart map
  static Map<String, List<AdminLicenseManagerItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminLicenseManagerItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminLicenseManagerItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantRole',
    'user',
  };
}

