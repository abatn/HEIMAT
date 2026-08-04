/// search_dto.dart — DTO for Universal Search API Response
///
/// Backend: GET /api/search?q=...&lat=...&lng=...
/// Returns categorized results (doctors, parking, EV charging, addresses)

class SearchResponse {
  final String query;
  final int count;
  final Map<String, int> categories;
  final List<SearchResultDto> results;

  SearchResponse({
    required this.query,
    required this.count,
    required this.categories,
    required this.results,
  });

  factory SearchResponse.fromJson(Map<String, dynamic> json) {
    return SearchResponse(
      query: json['query'] as String? ?? '',
      count: json['count'] as int? ?? 0,
      categories: (json['categories'] as Map<String, dynamic>?)
              ?.map((k, v) => MapEntry(k, v as int)) ??
          {},
      results: (json['results'] as List<dynamic>?)
              ?.map((r) => SearchResultDto.fromJson(r as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class SearchResultDto {
  final String id;
  final String category; // doctor | parking | ev_charging | address | event
  final String name;
  final String description;
  final double? distance;
  final double? lat;
  final double? lng;
  final double relevance;

  SearchResultDto({
    required this.id,
    required this.category,
    required this.name,
    required this.description,
    this.distance,
    this.lat,
    this.lng,
    required this.relevance,
  });

  factory SearchResultDto.fromJson(Map<String, dynamic> json) {
    return SearchResultDto(
      id: json['id'] as String? ?? '',
      category: json['category'] as String? ?? 'address',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      distance: (json['distance'] as num?)?.toDouble(),
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      relevance: (json['relevance'] as num?)?.toDouble() ?? 0.5,
    );
  }
}
