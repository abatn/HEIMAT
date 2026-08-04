/// events_screen.dart — Events & Veranstaltungen
///
/// Nativ via Wikidata SPARQL + OSM Overpass.
/// KEINE hardcodierten Seiten — alles echte API-Calls.
///
/// Backend: GET /api/events?lat=...&lng=...&radius=...

import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/services/location_service.dart';
import 'events_dto.dart';

class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  EventsResponse? _response;
  bool _loading = true;
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
      _loadEvents();
    } else if (mounted) {
      setState(() {
        _error = 'Standort nicht verfügbar. Bitte GPS aktivieren.';
        _loading = false;
      });
    }
  }

  Future<void> _loadEvents() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (_lat == null || _lng == null) return;
      final response = await http.get(
        Uri.parse(
          'https://heimat-backend.onrender.com/api/events'
          '?lat=$_lat&lng=$_lng&radius=10',
        ),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _response = EventsResponse.fromJson(json);
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

  List<EventDto> get _filteredEvents {
    if (_response == null) return [];
    if (_selectedCategory == 'all') return _response!.events;
    return _response!.events
        .where((e) => e.category == _selectedCategory)
        .toList();
  }

  Set<String> get _categories {
    if (_response == null) return {};
    return _response!.events.map((e) => e.category).toSet();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🎪 Veranstaltungen'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.deepPurple.shade400, Colors.deepPurple.shade800],
          ),
        ),
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: Colors.white))
            : _error != null
                ? _buildError()
                : _buildContent(),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.event_busy, size: 64, color: Colors.white54),
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadEvents,
              child: const Text('Erneut versuchen'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_response == null || _response!.events.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.white54),
            SizedBox(height: 16),
            Text(
              'Keine Veranstaltungen gefunden.',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadEvents,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header
          Text(
            '${_response!.events.length} Veranstaltung${_response!.events.length == 1 ? '' : 'en'}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'In deiner Nähe (${_response!.radius.toStringAsFixed(0)} km)',
            style: const TextStyle(color: Colors.white54, fontSize: 14),
          ),
          const SizedBox(height: 16),

          // Category chips
          if (_categories.length > 1) _buildCategoryChips(),
          const SizedBox(height: 16),

          // Events list
          ..._filteredEvents.map((event) => _buildEventCard(event)),
        ],
      ),
    );
  }

  Widget _buildCategoryChips() {
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(
                'Alle (${_response!.events.length})',
                style: TextStyle(
                  color: _selectedCategory == 'all'
                      ? Colors.deepPurple.shade900
                      : Colors.white,
                  fontSize: 13,
                ),
              ),
              selected: _selectedCategory == 'all',
              selectedColor: Colors.white,
              backgroundColor: Colors.white.withOpacity(0.15),
              onSelected: (_) => setState(() => _selectedCategory = 'all'),
            ),
          ),
          ..._categories.map((cat) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(
                    cat,
                    style: TextStyle(
                      color: _selectedCategory == cat
                          ? Colors.deepPurple.shade900
                          : Colors.white,
                      fontSize: 13,
                    ),
                  ),
                  selected: _selectedCategory == cat,
                  selectedColor: Colors.white,
                  backgroundColor: Colors.white.withOpacity(0.15),
                  onSelected: (_) => setState(() => _selectedCategory = cat),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildEventCard(EventDto event) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.15)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Category + Source
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getSourceColor(event.source),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    event.category,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  event.source == 'wikidata' ? 'Wikidata' : 'OpenStreetMap',
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Name
            Text(
              event.name,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),

            // Description
            if (event.description.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                event.description,
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.white70,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],

            // Location + Date
            if (event.location != null || event.startDate != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  if (event.location != null) ...[
                    const Icon(Icons.location_on,
                        size: 14, color: Colors.white54),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        event.location!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white54,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                  if (event.startDate != null) ...[
                    const SizedBox(width: 12),
                    const Icon(Icons.calendar_today,
                        size: 14, color: Colors.white54),
                    const SizedBox(width: 4),
                    Text(
                      _formatDate(event.startDate!),
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.white54,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _getSourceColor(String source) {
    if (source == 'wikidata') return Colors.blue.shade800;
    return Colors.green.shade800;
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      return '${dt.day}.${dt.month}.${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}
