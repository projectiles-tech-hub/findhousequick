import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../providers.dart';

/// One identity check, as the server describes it. The server alone decides what a check's result means (ADR 0007).
class IdentityCheck {
  const IdentityCheck({required this.id, required this.idType, required this.last4, required this.status, this.failureReason, this.nextAction, this.documentAttached = false});

  final String id;
  final String idType;
  final String last4;

  /// PENDING, PASSED, FAILED or MANUAL_REVIEW.
  final String status;
  final String? failureReason;
  final String? nextAction;
  final bool documentAttached;

  bool get passed => status == 'PASSED';
  bool get pending => status == 'PENDING';

  /// The face was not confirmed as live: trying again is the way forward, a document does not help.
  bool get faceFailed => status == 'FAILED' && failureReason == 'LIVENESS_FAILED';

  /// A photo of an ID document may be added (decision 49).
  bool get wantsDocument => nextAction == 'UPLOAD_ID_DOCUMENT' && !documentAttached;

  /// A person on the verification team is looking at it.
  bool get withTeam => status == 'MANUAL_REVIEW' && !wantsDocument;

  factory IdentityCheck.fromJson(Map<String, dynamic> j) => IdentityCheck(
        id: j['id'] as String,
        idType: (j['idType'] as String?) ?? '',
        last4: (j['idNumberLast4'] as String?) ?? '',
        status: (j['status'] as String?) ?? 'PENDING',
        failureReason: j['failureReason'] as String?,
        nextAction: j['nextAction'] as String?,
        documentAttached: j['documentAttached'] == true,
      );
}

class AgentProfile {
  const AgentProfile({required this.businessName, this.registrationNumber, required this.status});
  final String businessName;
  final String? registrationNumber;

  /// PENDING, PASSED or FAILED.
  final String status;

  factory AgentProfile.fromJson(Map<String, dynamic> j) => AgentProfile(
        businessName: (j['businessName'] as String?) ?? '',
        registrationNumber: j['registrationNumber'] as String?,
        status: (j['status'] as String?) ?? 'PENDING',
      );
}

class DocumentType {
  const DocumentType(this.code, this.label);
  final String code;
  final String label;
}

class VerificationApi {
  VerificationApi(this._api);
  final ApiClient _api;

  Future<IdentityCheck> startCheck({required String idType, required String idNumber}) async =>
      IdentityCheck.fromJson(await _api.postJson('/identity/checks', body: {'idType': idType, 'idNumber': idNumber, 'consent': true}));

  Future<IdentityCheck> check(String id) async => IdentityCheck.fromJson(await _api.getJson('/identity/checks/$id'));

  /// The newest check, if the user has started one.
  Future<IdentityCheck?> latestCheck() async {
    final list = await _api.getList('/identity/checks');
    return list.isEmpty ? null : IdentityCheck.fromJson((list.first as Map).cast<String, dynamic>());
  }

  /// The names of the documents this country accepts as a photo of an ID, in the order the country lists them.
  Future<List<DocumentType>> idDocumentTypes(String countryCode, List<String> accepted) async {
    final all = await _api.getList('/reference/countries/$countryCode/document-types');
    final labels = {for (final t in all.cast<Map>()) t['code'] as String: (t['label'] as String?) ?? t['code'] as String};
    return [for (final code in accepted) DocumentType(code, labels[code] ?? code)];
  }

  /// Sends a photo of an ID document to private storage and attaches it to the check, which then goes to the
  /// verification team. [idempotencyKey] makes pressing the button twice harmless.
  Future<IdentityCheck> addDocument({
    required String checkId,
    required String documentTypeCode,
    required Uint8List bytes,
    required String contentType,
    required String idempotencyKey,
  }) async {
    final ticket = await _api.postJson(
      '/documents',
      idempotencyKey: idempotencyKey,
      body: {
        'documentTypeCode': documentTypeCode,
        'purpose': 'IDENTITY',
        'contentType': contentType,
        'sizeBytes': bytes.length,
        'sha256': sha256.convert(bytes).toString(),
      },
    );
    final headers = ((ticket['uploadHeaders'] as Map?) ?? const {}).map((k, v) => MapEntry('$k', '$v'));
    await _api.uploadTo(ticket['uploadUrl'] as String, bytes, headers);
    final documentId = ticket['documentId'] as String;
    await _api.postJson('/documents/$documentId/complete');
    return IdentityCheck.fromJson(await _api.postJson('/identity/checks/$checkId/document', body: {'documentId': documentId}));
  }

  Future<AgentProfile?> agentProfile() async {
    try {
      return AgentProfile.fromJson(await _api.getJson('/me/agent-profile'));
    } on ApiException catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<AgentProfile> saveAgentProfile({required String businessName, String? registrationNumber}) async => AgentProfile.fromJson(
        await _api.putJson('/me/agent-profile', body: {'businessName': businessName, 'registrationNumber': ?registrationNumber}),
      );
}

final verificationApiProvider = Provider<VerificationApi>((ref) => VerificationApi(ref.watch(apiClientProvider)));

/// Checks an ID number against the country's pattern for its type, the same way the server does: spaces and dashes
/// removed, letters made capitals. Without a pattern, 4 to 30 letters and digits are accepted.
bool idNumberLooksRight(String typed, String? pattern) {
  final clean = typed.replaceAll(RegExp(r'[\s-]'), '').toUpperCase();
  return RegExp(pattern ?? r'^[A-Z0-9]{4,30}$').hasMatch(clean);
}

/// JPEG or PNG, told from the first bytes of the file rather than its name. Null for anything else.
String? photoContentType(Uint8List bytes) {
  if (bytes.length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return 'image/jpeg';
  if (bytes.length > 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return 'image/png';
  return null;
}
