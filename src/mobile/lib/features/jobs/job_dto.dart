/// job_dto.dart — DTO für Job-Suche
///
/// Datenquelle: Backend /api/jobs/search → Adzuna + Arbeitnow
/// Pattern-Mirror zu air_quality_dto.dart / waste_dto.dart

class JobListing {
  final String slug;
  final String companyName;
  final String title;
  final String description;
  final bool remote;
  final String url;
  final List<String> tags;
  final List<String> jobTypes;
  final String location;
  final int createdAt;
  // Adzuna-spezifische Felder
  final int? salaryMin;
  final int? salaryMax;
  final bool salaryIsPredicted;
  final String? category;
  final String source;

  const JobListing({
    required this.slug,
    required this.companyName,
    required this.title,
    required this.description,
    required this.remote,
    required this.url,
    required this.tags,
    required this.jobTypes,
    required this.location,
    required this.createdAt,
    this.salaryMin,
    this.salaryMax,
    this.salaryIsPredicted = false,
    this.category,
    this.source = 'arbeitnow',
  });

  factory JobListing.fromJson(Map<String, dynamic> json) {
    return JobListing(
      slug: json['slug']?.toString() ?? '',
      companyName: json['company_name']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      remote: json['remote'] == true,
      url: json['url']?.toString() ?? '',
      tags:
          (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ??
              [],
      jobTypes: (json['job_types'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      location: json['location']?.toString() ?? '',
      createdAt: json['created_at'] ?? 0,
      salaryMin: json['salary_min'] as int?,
      salaryMax: json['salary_max'] as int?,
      salaryIsPredicted: json['salary_is_predicted'] == true,
      category: json['category']?.toString(),
      source: json['source']?.toString() ?? 'arbeitnow',
    );
  }

  /// Kurze Beschreibung (max 150 Zeichen)
  String get shortDescription {
    if (description.length <= 150) return description;
    return '${description.substring(0, 147)}...';
  }

  /// Relative Zeitangabe
  String get relativeTime {
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final diff = now - createdAt;
    if (diff < 3600) return 'Vor ${diff ~/ 60} Min';
    if (diff < 86400) return 'Vor ${diff ~/ 3600}h';
    if (diff < 604800) return 'Vor ${diff ~/ 86400} Tagen';
    return 'Vor ${diff ~/ 604800} Wochen';
  }

  /// Formatiertes Gehalt (falls vorhanden)
  String? get formattedSalary {
    if (salaryMin == null && salaryMax == null) return null;

    final formatter = (int value) {
      if (value >= 1000) {
        return '€${(value / 1000).toStringAsFixed(0)}.000';
      }
      return '€$value';
    };

    if (salaryMin != null && salaryMax != null) {
      return '${formatter(salaryMin!)} - ${formatter(salaryMax!)}/Jahr';
    }
    if (salaryMin != null) return 'Ab ${formatter(salaryMin!)}/Jahr';
    if (salaryMax != null) return 'Bis ${formatter(salaryMax!)}/Jahr';
    return null;
  }
}

class JobSearchResult {
  final List<JobListing> jobs;
  final int total;
  final int page;
  final int perPage;
  final String source;

  const JobSearchResult({
    required this.jobs,
    required this.total,
    required this.page,
    required this.perPage,
    this.source = 'mixed',
  });

  factory JobSearchResult.fromJson(Map<String, dynamic> json) {
    return JobSearchResult(
      jobs: (json['jobs'] as List<dynamic>?)
              ?.map((e) => JobListing.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      total: json['total'] ?? 0,
      page: json['page'] ?? 0,
      perPage: json['per_page'] ?? 20,
      source: json['source']?.toString() ?? 'mixed',
    );
  }
}

/// Verfügbare Branchen für den Filter
class BranchenFilter {
  static const Map<String, String> labels = {
    'alle': 'Alle',
    'technik': 'Technik',
    'gesundheit': 'Gesundheit',
    'handwerk': 'Handwerk',
    'bildung': 'Bildung',
    'gastro': 'Gastro',
    'verwaltung': 'Verwaltung',
    'logistik': 'Logistik',
  };

  static List<String> get all => labels.keys.toList();
}
