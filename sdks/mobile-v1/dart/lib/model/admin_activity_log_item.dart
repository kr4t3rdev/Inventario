//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminActivityLogItem {
  /// Returns a new [AdminActivityLogItem] instance.
  AdminActivityLogItem({
    required this.id,
    required this.userId,
    required this.action,
    this.details,
    this.ipAddress,
    this.userAgent,
    this.performedBy,
    this.createdAt,
  });

  String id;

  String userId;

  String action;

  String? details;

  String? ipAddress;

  String? userAgent;

  String? performedBy;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminActivityLogItem &&
    other.id == id &&
    other.userId == userId &&
    other.action == action &&
    other.details == details &&
    other.ipAddress == ipAddress &&
    other.userAgent == userAgent &&
    other.performedBy == performedBy &&
    other.createdAt == createdAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id.hashCode) +
    (userId.hashCode) +
    (action.hashCode) +
    (details == null ? 0 : details!.hashCode) +
    (ipAddress == null ? 0 : ipAddress!.hashCode) +
    (userAgent == null ? 0 : userAgent!.hashCode) +
    (performedBy == null ? 0 : performedBy!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode);

  @override
  String toString() => 'AdminActivityLogItem[id=$id, userId=$userId, action=$action, details=$details, ipAddress=$ipAddress, userAgent=$userAgent, performedBy=$performedBy, createdAt=$createdAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'id'] = this.id;
      json[r'userId'] = this.userId;
      json[r'action'] = this.action;
    if (this.details != null) {
      json[r'details'] = this.details;
    } else {
      json[r'details'] = null;
    }
    if (this.ipAddress != null) {
      json[r'ipAddress'] = this.ipAddress;
    } else {
      json[r'ipAddress'] = null;
    }
    if (this.userAgent != null) {
      json[r'userAgent'] = this.userAgent;
    } else {
      json[r'userAgent'] = null;
    }
    if (this.performedBy != null) {
      json[r'performedBy'] = this.performedBy;
    } else {
      json[r'performedBy'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    return json;
  }

  /// Returns a new [AdminActivityLogItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminActivityLogItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminActivityLogItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminActivityLogItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminActivityLogItem(
        id: mapValueOfType<String>(json, r'id')!,
        userId: mapValueOfType<String>(json, r'userId')!,
        action: mapValueOfType<String>(json, r'action')!,
        details: mapValueOfType<String>(json, r'details'),
        ipAddress: mapValueOfType<String>(json, r'ipAddress'),
        userAgent: mapValueOfType<String>(json, r'userAgent'),
        performedBy: mapValueOfType<String>(json, r'performedBy'),
        createdAt: mapDateTime(json, r'createdAt', r''),
      );
    }
    return null;
  }

  static List<AdminActivityLogItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminActivityLogItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminActivityLogItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminActivityLogItem> mapFromJson(dynamic json) {
    final map = <String, AdminActivityLogItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminActivityLogItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminActivityLogItem-objects as value to a dart map
  static Map<String, List<AdminActivityLogItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminActivityLogItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminActivityLogItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'id',
    'userId',
    'action',
  };
}

