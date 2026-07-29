import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../lib/core/services/auth_service.dart';
import '../lib/features/checkin/presentation/checkin_provider.dart';
import '../lib/features/checkin/checkin_dto.dart';

void main() {
  late CheckinProvider provider;
  late AuthService authService;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    authService = AuthService();
    provider = CheckinProvider(authService);
  });

  // ==================================================================
  // Group 1: Initial State — Konstruktor-Defaults
  // ==================================================================
  group('Initial state — Konstruktor-Defaults', () {
    test('should not be active initially', () {
      expect(provider.isActive, false);
    });

    test('should not be loading initially', () {
      expect(provider.isLoading, false);
    });

    test('should have no error initially', () {
      expect(provider.error, isNull);
    });

    test('should have null status initially', () {
      expect(provider.status, isNull);
    });

    test('should have empty events initially', () {
      expect(provider.events, isEmpty);
    });

    test('should have null settings initially', () {
      expect(provider.settings, isNull);
    });

    test('should not have loaded initially', () {
      expect(provider.hasLoaded, false);
    });

    test('should have null lastPingResult initially', () {
      expect(provider.lastPingResult, isNull);
    });
  });

  // ==================================================================
  // Group 2: AuthService Injection
  // ==================================================================
  group('AuthService Injection', () {
    test('should accept AuthService via constructor', () {
      expect(provider, isNotNull);
    });

    test('should reflect auth state from authService', () {
      expect(authService.isAuthenticated, false);
      // Without JWT, API calls should fail gracefully
    });
  });

  // ==================================================================
  // Group 3: Escalation Description
  // ==================================================================
  group('Escalation Description', () {
    test('should return correct description for stage 0', () {
      final desc = CheckinProvider.escalationDescription(0);
      expect(desc, contains('Alles okay'));
    });

    test('should return correct description for stage 1', () {
      final desc = CheckinProvider.escalationDescription(1);
      expect(desc, contains('überschritten'));
    });

    test('should return correct description for stage 2', () {
      final desc = CheckinProvider.escalationDescription(2);
      expect(desc, contains('Erinnerung'));
    });

    test('should return correct description for stage 3', () {
      final desc = CheckinProvider.escalationDescription(3);
      expect(desc, contains('Notfallkontakt'));
    });

    test('should return correct description for stage 4', () {
      final desc = CheckinProvider.escalationDescription(4);
      expect(desc, contains('Rettungsdienst'));
    });

    test('should handle unknown stage', () {
      final desc = CheckinProvider.escalationDescription(99);
      expect(desc, contains('unbekannt'));
    });
  });

  // ==================================================================
  // Group 4: DTO fromJson Parsing
  // ==================================================================
  group('CheckinStatusDto fromJson', () {
    test('should parse active status correctly', () {
      final json = {
        'isActive': true,
        'timeSinceLastPingMinutes': 120,
        'currentIntervalHours': 24,
        'escalationStage': 0,
        'nextPingDueAt': '2026-07-30T10:00:00Z',
        'healthContextActive': false,
      };
      final dto = CheckinStatusDto.fromJson(json);
      expect(dto.isActive, true);
      expect(dto.timeSinceLastPingMinutes, 120);
      expect(dto.currentIntervalHours, 24);
      expect(dto.escalationStage, 0);
      expect(dto.nextPingDueAt, '2026-07-30T10:00:00Z');
      expect(dto.healthContextActive, false);
    });

    test('should parse inactive status correctly', () {
      final json = {'isActive': false};
      final dto = CheckinStatusDto.fromJson(json);
      expect(dto.isActive, false);
      expect(dto.escalationStage, 0);
      expect(dto.healthContextActive, false);
    });

    test('should handle missing fields gracefully', () {
      final json = <String, dynamic>{};
      final dto = CheckinStatusDto.fromJson(json);
      expect(dto.isActive, false);
      expect(dto.escalationStage, 0);
      expect(dto.timeSinceLastPingMinutes, isNull);
      expect(dto.currentIntervalHours, isNull);
    });
  });

  group('CheckinSettingsDto fromJson', () {
    test('should parse full settings correctly', () {
      final json = {
        'intervalHours': 12,
        'intervalHealthHours': 4,
        'emergencyContactName': 'Anna Schmidt',
        'emergencyContactPhone': '+491701234567',
        'emergencyContactEmail': 'anna@example.com',
        'auto112Enabled': true,
        'lastPingAt': '2026-07-29T08:00:00Z',
      };
      final dto = CheckinSettingsDto.fromJson(json);
      expect(dto.intervalHours, 12);
      expect(dto.intervalHealthHours, 4);
      expect(dto.emergencyContactName, 'Anna Schmidt');
      expect(dto.auto112Enabled, true);
    });

    test('should use defaults for missing fields', () {
      final json = <String, dynamic>{};
      final dto = CheckinSettingsDto.fromJson(json);
      expect(dto.intervalHours, 24);
      expect(dto.intervalHealthHours, 6);
      expect(dto.auto112Enabled, false);
      expect(dto.emergencyContactName, isNull);
    });

    test('should serialize to JSON', () {
      final dto = CheckinSettingsDto(
        intervalHours: 12,
        auto112Enabled: true,
        emergencyContactName: 'Test',
      );
      final json = dto.toJson();
      expect(json['intervalHours'], 12);
      expect(json['auto112Enabled'], true);
      expect(json['emergencyContactName'], 'Test');
      expect(json.containsKey('intervalHealthHours'), true);
      expect(json.containsKey('emergencyContactPhone'), false);
    });
  });

  group('CheckinEventDto fromJson', () {
    test('should parse ping event correctly', () {
      final json = {
        'id': 'evt-1',
        'event_type': 'ping',
        'escalation_stage': 0,
        'details': 'Regulärer Check-in',
        'created_at': '2026-07-29T08:00:00Z',
      };
      final dto = CheckinEventDto.fromJson(json);
      expect(dto.id, 'evt-1');
      expect(dto.eventType, 'ping');
      expect(dto.escalationStage, 0);
      expect(dto.details, 'Regulärer Check-in');
    });

    test('should handle camelCase keys as fallback', () {
      final json = {
        'id': 'evt-2',
        'eventType': 'activated',
        'escalationStage': 0,
        'createdAt': '2026-07-29T09:00:00Z',
      };
      final dto = CheckinEventDto.fromJson(json);
      expect(dto.eventType, 'activated');
      expect(dto.escalationStage, 0);
    });

    test('should handle empty JSON', () {
      final json = <String, dynamic>{};
      final dto = CheckinEventDto.fromJson(json);
      expect(dto.id, '');
      expect(dto.eventType, '');
      expect(dto.escalationStage, 0);
      expect(dto.createdAt, '');
    });
  });

  group('CheckinPingResult fromJson', () {
    test('should parse ping result correctly', () {
      final json = {
        'message': 'Check-in bestätigt',
        'nextPingDueAt': '2026-07-30T08:00:00Z',
        'escalationStage': 0,
        'healthContextActive': false,
      };
      final dto = CheckinPingResult.fromJson(json);
      expect(dto.message, 'Check-in bestätigt');
      expect(dto.nextPingDueAt, '2026-07-30T08:00:00Z');
      expect(dto.escalationStage, 0);
    });

    test('should handle empty message', () {
      final json = <String, dynamic>{};
      final dto = CheckinPingResult.fromJson(json);
      expect(dto.message, '');
      expect(dto.escalationStage, 0);
      expect(dto.healthContextActive, false);
    });
  });
}
