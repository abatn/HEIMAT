/// search_screen.dart — Universelle Suche über alle Services
///
/// Ein einziges Suchfeld für ALLES:
/// - Ärzte (Overpass)
/// - Parkplätze (Overpass)
/// - E-Ladestationen (Overpass)
/// - Adressen (Nominatim)
///
/// Backend: GET /api/search?q=...&lat=...&lng=...
///
/// Design: Suchleiste + Kategorie-Chips + Ergebnisliste

import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/services/location_service.dart';
import 'search_dto.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  SearchResponse? _response;
  bool _loading = false;
  String? _error;
  String _selectedCategory = 'all';
  double? _lat;
  double? _lng;

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  Future<void> _loadLocation() async {
    final pos = await LocationService.getCurrentLocation().timeout(
      const Duration(seconds: 5),
      onTimeout: () => null,
    );
    if (pos != null && mounted) {
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
      });
      _focusNode.requestFocus();
    } else if (mounted) {
      setState(() {
        _error = 'Standort nicht verfügbar. Bitte GPS aktivieren.';
      });
      _focusNode.requestFocus();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    if (query.trim().isEmpty) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (_lat == null || _lng == null) {
        setState(() {
          _error = 'Standort nicht verfügbar.';
          _loading = false;
        });
        return;
      }
      final response = await http.get(
        Uri.parse(
          'https://heimat-backend.onrender.com/api/search'
          '?q=${Uri.encodeComponent(query)}'
          '&lat=$_lat&lng=$_lng',
        ),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _response = SearchResponse.fromJson(json);
          _loading = false;
        });
      } else {
        setState(() {
          _error = 'Fehler: ${response.statusCode}';
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Netzwerkfehler: $e';
        _loading = false;
      });
    }
  }

  List<SearchResultDto> get _filteredResults {
    if (_response == null) return [];
    if (_selectedCategory == 'all') return _response!.results;
    return _response!.results
        .where((r) => r.category == _selectedCategory)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🔍 Suche'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.teal.shade400, Colors.teal.shade800],
          ),
        ),
        child: Column(
          children: [
            // Search bar
            _buildSearchBar(),

            // Category chips
            if (_response != null) _buildCategoryChips(),

            // Results
            Expanded(child: _buildResults()),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.2)),
      ),
      child: TextField(
        controller: _searchController,
        focusNode: _focusNode,
        style: const TextStyle(color: Colors.white, fontSize: 16),
        decoration: InputDecoration(
          hintText: 'Was suchst du? (z.B. Arzt, Parken, Ladestation)',
          hintStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
          prefixIcon: const Icon(Icons.search, color: Colors.white70),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, color: Colors.white70),
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _response = null);
                  },
                )
              : null,
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        onSubmitted: _search,
        onChanged: (value) => setState(() {}),
      ),
    );
  }

  Widget _buildCategoryChips() {
    if (_response == null) return const SizedBox.shrink();

    final categories = <String, String>{
      'all': 'Alle (${_response!.count})',
      'doctor': '🏥 Ärzte',
      'parking': '🅿️ Parken',
      'ev_charging': '⚡ Laden',
      'address': '📍 Adressen',
    };

    // Only show categories that have results
    final available = categories.entries.where((e) {
      if (e.key == 'all') return true;
      return (_response!.categories[e.key] ?? 0) > 0;
    }).toList();

    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: available.map((entry) {
          final isSelected = _selectedCategory == entry.key;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(
                entry.value,
                style: TextStyle(
                  color: isSelected ? Colors.teal.shade900 : Colors.white,
                  fontSize: 13,
                ),
              ),
              selected: isSelected,
              selectedColor: Colors.white,
              backgroundColor: Colors.white.withOpacity(0.15),
              onSelected: (_) {
                setState(() => _selectedCategory = entry.key);
              },
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildResults() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.white54),
              const SizedBox(height: 16),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 16),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => _search(_searchController.text),
                child: const Text('Erneut versuchen'),
              ),
            ],
          ),
        ),
      );
    }

    if (_response == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search, size: 64, color: Colors.white54),
            SizedBox(height: 16),
            Text(
              'Suche nach Ärzten, Parkplätzen, Ladestationen...',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ),
          ],
        ),
      );
    }

    if (_filteredResults.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.white54),
            SizedBox(height: 16),
            Text(
              'Keine Ergebnisse gefunden.',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _filteredResults.length,
      itemBuilder: (context, index) {
        return _buildResultCard(_filteredResults[index]);
      },
    );
  }

  Widget _buildResultCard(SearchResultDto result) {
    final icon = _getCategoryIcon(result.category);
    final color = _getCategoryColor(result.category);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.15)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(12),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(icon, style: const TextStyle(fontSize: 24)),
          ),
        ),
        title: Text(
          result.name,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              result.description,
              style: const TextStyle(color: Colors.white70, fontSize: 13),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            if (result.distance != null) ...[
              const SizedBox(height: 4),
              Text(
                '📍 ${result.distance!.toStringAsFixed(1)} km',
                style: const TextStyle(
                  color: Colors.white54,
                  fontSize: 12,
                ),
              ),
            ],
          ],
        ),
        trailing: const Icon(
          Icons.chevron_right,
          color: Colors.white54,
        ),
      ),
    );
  }

  String _getCategoryIcon(String category) {
    switch (category) {
      case 'doctor':
        return '🏥';
      case 'parking':
        return '🅿️';
      case 'ev_charging':
        return '⚡';
      case 'address':
        return '📍';
      case 'event':
        return '🎪';
      default:
        return '📌';
    }
  }

  Color _getCategoryColor(String category) {
    switch (category) {
      case 'doctor':
        return Colors.red.shade800;
      case 'parking':
        return Colors.blue.shade800;
      case 'ev_charging':
        return Colors.green.shade800;
      case 'address':
        return Colors.purple.shade800;
      case 'event':
        return Colors.orange.shade800;
      default:
        return Colors.grey.shade800;
    }
  }
}
