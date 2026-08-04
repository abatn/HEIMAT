import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../miniprogram/domain/service_registry.dart';
import '../miniprogram/domain/service_definition.dart';
import '../miniprogram/presentation/native_mini_program_screen.dart';
import '../miniprogram/presentation/miniprogram_model.dart';

/// ServicesScreen — Kategorisierter Dienste-Tab (WeChat-Muster)
///
/// Ersetzt den alten LaunchpadScreen (15 flache Apps im Grid).
/// Struktur: Suche + Häufig benutzt + Kategorien
class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key});

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Globale Suche (oben)
        _buildSearchBar(),
        // Kategorisierter Content
        Expanded(
          child: _searchQuery.isEmpty
              ? _buildCategorizedList()
              : _buildSearchResults(),
        ),
      ],
    );
  }

  // ------------------------------------------------------------------
  // Suche
  // ------------------------------------------------------------------

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: TextField(
        controller: _searchController,
        onChanged: (value) =>
            setState(() => _searchQuery = value.toLowerCase()),
        decoration: InputDecoration(
          hintText: '🔍 Suche nach Diensten...',
          prefixIcon: const Icon(Icons.search, size: 20),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 20),
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _searchQuery = '');
                  },
                )
              : null,
          filled: true,
          fillColor: AppColors.surface,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: AppColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: AppColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: AppColors.primary, width: 2),
          ),
        ),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Kategorisierte Liste
  // ------------------------------------------------------------------

  Widget _buildCategorizedList() {
    final registry = ServiceRegistry.instance;
    final grouped = registry.categoriesGrouped();

    // Kategorie-Emojis
    const categoryEmojis = {
      'Mobilität': '🚗',
      'Gesundheit': '🏥',
      'Alltag': '🏠',
      'Kultur & Reise': '🎪',
      'Finanzen': '💰',
      'AI': '💬',
    };

    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        // Häufig benutzt
        _buildFrequentlyUsedSection(),
        const SizedBox(height: 8),
        // Kategorien aus Registry (dynamisch, nicht hardcodiert)
        ...grouped.map((entry) {
          final (category, services) = entry;
          final emoji = categoryEmojis[category] ?? '📌';
          return _buildCategorySection(
            emoji,
            category,
            services.map((s) => s.id).toList(),
          );
        }),
      ],
    );
  }

  // ------------------------------------------------------------------
  // Häufig benutzt
  // ------------------------------------------------------------------

  Widget _buildFrequentlyUsedSection() {
    final frequent = ServiceRegistry.instance.frequentlyUsed();
    if (frequent.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            '⚡ Häufig benutzt',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        SizedBox(
          height: 90,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: frequent.length,
            itemBuilder: (context, index) {
              return _buildFrequentCard(frequent[index]);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFrequentCard(ServiceDefinition service) {
    return GestureDetector(
      onTap: () => _openService(service),
      child: Container(
        width: 80,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _getIconForService(service.id),
              size: 28,
              color: AppColors.primary,
            ),
            const SizedBox(height: 6),
            Text(
              service.name,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Kategorie-Sektion
  // ------------------------------------------------------------------

  Widget _buildCategorySection(
      String emoji, String title, List<String> serviceIds) {
    final registry = ServiceRegistry.instance;
    final services = serviceIds
        .map((id) => registry.lookup(id))
        .where((s) => s != null)
        .cast<ServiceDefinition>()
        .toList();

    if (services.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            '$emoji $title',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        ...services.map((service) => _buildServiceTile(service)),
      ],
    );
  }

  Widget _buildServiceTile(ServiceDefinition service) {
    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: AppColors.primary.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(
          _getIconForService(service.id),
          size: 22,
          color: AppColors.primary,
        ),
      ),
      title: Text(
        service.name,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w500,
          color: AppColors.textPrimary,
        ),
      ),
      subtitle: Text(
        service.description ?? '',
        style: const TextStyle(
          fontSize: 13,
          color: AppColors.textSecondary,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: const Icon(
        Icons.chevron_right,
        size: 20,
        color: AppColors.textSecondary,
      ),
      onTap: () => _openService(service),
    );
  }

  // ------------------------------------------------------------------
  // Suchergebnisse
  // ------------------------------------------------------------------

  Widget _buildSearchResults() {
    final registry = ServiceRegistry.instance;
    final allServices = [
      'ai_chat',
      'weather',
      'air',
      'waste',
      'ev_charging',
      'parking',
      'mobility',
      'finance',
      'health',
      'checkin',
      'events',
      'jobs',
      'hotels',
      'buergeramt',
    ];

    final results = allServices
        .map((id) => registry.lookup(id))
        .where((s) => s != null)
        .cast<ServiceDefinition>()
        .where((s) =>
            s.name.toLowerCase().contains(_searchQuery) ||
            (s.description ?? '').toLowerCase().contains(_searchQuery) ||
            (s.searchTags ?? []).any((tag) => tag.contains(_searchQuery)))
        .toList();

    if (results.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off,
                size: 64, color: AppColors.textSecondary.withOpacity(0.3)),
            const SizedBox(height: 16),
            Text(
              'Keine Dienste gefunden',
              style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 24),
      itemCount: results.length,
      itemBuilder: (context, index) => _buildServiceTile(results[index]),
    );
  }

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------

  void _openService(ServiceDefinition service) {
    final program = MiniProgram(
      id: service.id,
      name: service.name,
      url: 'native://registry/${service.id}',
      iconPath: '',
      description: service.description ?? '',
      category: service.category ?? 'Sonstiges',
      useNative: true,
    );
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => NativeMiniProgramScreen(program: program),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Icon-Mapping
  // ------------------------------------------------------------------

  IconData _getIconForService(String id) {
    switch (id) {
      case 'ai_chat':
        return Icons.chat_bubble_outline;
      case 'weather':
        return Icons.wb_sunny_outlined;
      case 'air':
        return Icons.air;
      case 'waste':
        return Icons.delete_outline;
      case 'ev_charging':
        return Icons.ev_station_outlined;
      case 'parking':
        return Icons.local_parking_outlined;
      case 'mobility':
        return Icons.directions_bus_outlined;
      case 'finance':
        return Icons.account_balance_wallet_outlined;
      case 'health':
        return Icons.local_hospital_outlined;
      case 'checkin':
        return Icons.check_circle_outline;
      case 'events':
        return Icons.event_outlined;
      case 'jobs':
        return Icons.work_outline;
      case 'hotels':
        return Icons.hotel_outlined;
      case 'buergeramt':
        return Icons.account_balance_outlined;
      default:
        return Icons.apps;
    }
  }
}
