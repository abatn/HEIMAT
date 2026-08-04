/// events_screen.dart — Events & Veranstaltungen
///
/// Nativ via Wikidata SPARQL + OSM Overpass.
/// KEINE hardcodierten Seiten — alles echte API-Calls.
///
/// Backend: GET /api/events?lat=...&lng=...&radius=...

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'events_provider.dart';
import 'events_dto.dart';

class EventsScreen extends StatelessWidget {
  const EventsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => EventsProvider()..loadEvents(),
      child: const _EventsBody(),
    );
  }
}

class _EventsBody extends StatelessWidget {
  const _EventsBody();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Veranstaltungen'),
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
        child: Consumer<EventsProvider>(
          builder: (context, provider, _) {
            if (provider.isLoading) {
              return const Center(
                child: CircularProgressIndicator(color: Colors.white),
              );
            }
            if (provider.error != null) {
              return _buildError(context, provider);
            }
            return _buildContent(context, provider);
          },
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context, EventsProvider provider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.event_busy, size: 64, color: Colors.white54),
            const SizedBox(height: 16),
            Text(
              provider.error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => provider.loadEvents(),
              child: const Text('Erneut versuchen'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, EventsProvider provider) {
    if (provider.events.isEmpty) {
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
      onRefresh: () => provider.refresh(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            '${provider.count} Veranstaltung${provider.count == 1 ? '' : 'en'}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'In deiner Naehe (${provider.response!.radius.toStringAsFixed(0)} km)',
            style: const TextStyle(color: Colors.white54, fontSize: 14),
          ),
          const SizedBox(height: 16),
          if (provider.categories.length > 1)
            _buildCategoryChips(context, provider),
          const SizedBox(height: 16),
          ...provider.filteredEvents.map((event) => _buildEventCard(event)),
        ],
      ),
    );
  }

  Widget _buildCategoryChips(BuildContext context, EventsProvider provider) {
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(
                'Alle (${provider.events.length})',
                style: TextStyle(
                  color: provider.selectedCategory == 'all'
                      ? Colors.deepPurple.shade900
                      : Colors.white,
                  fontSize: 13,
                ),
              ),
              selected: provider.selectedCategory == 'all',
              selectedColor: Colors.white,
              backgroundColor: Colors.white.withOpacity(0.15),
              onSelected: (_) => provider.setCategory('all'),
            ),
          ),
          ...provider.categories.map((cat) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(
                    cat,
                    style: TextStyle(
                      color: provider.selectedCategory == cat
                          ? Colors.deepPurple.shade900
                          : Colors.white,
                      fontSize: 13,
                    ),
                  ),
                  selected: provider.selectedCategory == cat,
                  selectedColor: Colors.white,
                  backgroundColor: Colors.white.withOpacity(0.15),
                  onSelected: (_) => provider.setCategory(cat),
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
            Text(
              event.name,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
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
