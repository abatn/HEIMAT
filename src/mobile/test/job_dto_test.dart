import 'package:flutter_test/flutter_test.dart';
import '../lib/features/jobs/job_dto.dart';

void main() {
  // ==================================================================
  // Group 1: JobListing fromJson
  // ==================================================================
  group('JobListing fromJson', () {
    test('should parse full job listing correctly', () {
      final json = {
        'slug': 'flutter-dev-123',
        'company_name': 'Tech GmbH',
        'title': 'Flutter Entwickler',
        'description': '<p>Suche Flutter Entwickler</p>',
        'remote': true,
        'url': 'https://example.de/job/flutter-dev-123',
        'tags': ['flutter', 'dart'],
        'job_types': ['full_time'],
        'location': 'Berlin',
        'created_at': 1700000000,
      };
      final job = JobListing.fromJson(json);
      expect(job.slug, 'flutter-dev-123');
      expect(job.companyName, 'Tech GmbH');
      expect(job.title, 'Flutter Entwickler');
      expect(job.description, '<p>Suche Flutter Entwickler</p>');
      expect(job.remote, true);
      expect(job.url, 'https://example.de/job/flutter-dev-123');
      expect(job.tags, ['flutter', 'dart']);
      expect(job.jobTypes, ['full_time']);
      expect(job.location, 'Berlin');
      expect(job.createdAt, 1700000000);
    });

    test('should use defaults for missing fields', () {
      final json = <String, dynamic>{};
      final job = JobListing.fromJson(json);
      expect(job.slug, '');
      expect(job.companyName, '');
      expect(job.title, '');
      expect(job.description, '');
      expect(job.remote, false);
      expect(job.url, '');
      expect(job.tags, isEmpty);
      expect(job.jobTypes, isEmpty);
      expect(job.location, '');
      expect(job.createdAt, 0);
    });

    test('shortDescription should truncate long text', () {
      final json = {
        'description': 'A' * 200,
      };
      final job = JobListing.fromJson(json);
      expect(job.shortDescription.length, 150);
      expect(job.shortDescription, endsWith('...'));
    });

    test('shortDescription should not truncate short text', () {
      final json = {
        'description': 'Kurze Beschreibung',
      };
      final job = JobListing.fromJson(json);
      expect(job.shortDescription, 'Kurze Beschreibung');
    });

    test('url field should be preserved for url_launcher', () {
      final json = {
        'url': 'https://example.de/job/123',
      };
      final job = JobListing.fromJson(json);
      expect(job.url, 'https://example.de/job/123');
    });
  });

  // ==================================================================
  // Group 2: JobSearchResult fromJson
  // ==================================================================
  group('JobSearchResult fromJson', () {
    test('should parse full search result', () {
      final json = {
        'jobs': [
          {
            'slug': 'job-1',
            'title': 'Dev',
            'company_name': 'Co',
            'url': 'https://example.de/job/1',
          },
        ],
        'total': 1,
        'page': 0,
        'per_page': 20,
      };
      final result = JobSearchResult.fromJson(json);
      expect(result.jobs.length, 1);
      expect(result.total, 1);
      expect(result.page, 0);
      expect(result.perPage, 20);
    });

    test('should handle empty jobs list', () {
      final json = <String, dynamic>{};
      final result = JobSearchResult.fromJson(json);
      expect(result.jobs, isEmpty);
      expect(result.total, 0);
    });
  });
}
