import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/ai_context_model.dart';
import 'miniprogram_model.dart';
import 'miniprogram_provider.dart';
import 'miniprogram_container.dart';
import 'widgets/smart_program_card.dart';

/// Smart Launchpad - Intelligenter Mini-Program Hub (Phase C)
/// Innovationen:
///   1. Kontext-Greeting abhängig von Tageszeit (Morgen → "Gute Reise")
///   2. Hero-Program: großes Live-Widget für die relevanteste App
///   3. KI-Strip: 4 Empfehlungen je nach Tageszeit + Verlauf
///   4. Smart-Grid: 2-Spalten mit Live-Status (Wetter zeigt 18°C direkt)
///   5. Semantische Suche: Tag-Synonyme (z.B. "müll" → Abfallkalender)
class LaunchpadScreen extends StatefulWidget {
  final void Function(int tabIndex)? onNavigateTab;

  // ignore: unused_field
  const LaunchpadScreen({super.key, this.onNavigateTab});

  @override
  State<LaunchpadScreen> createState() => _LaunchpadScreenState();
}

class _LaunchpadScreenState extends State<LaunchpadScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MiniProgramProvider>().loadPrograms();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<MiniProgramProvider>(
      builder: (context, provider, _) {
        return Column(
          children: [
            _buildContextHeader(provider),
            _buildSearchBar(provider),
            if (provider.searchQuery.isEmpty) ...[
              if (provider.heroProgram != null)
                _buildHeroSection(context, provider, provider.heroProgram!),
              _buildAiStrip(context, provider),
              Expanded(child: _buildSmartGrid(context, provider)),
            ] else
              Expanded(child: _buildSearchResults(context, provider)),
          ],
        );
      },
    );
  }

  // -----------------------------------------------------------------
  // Header: Dynamischer Kontext-Greeting + Tageszeit-Icon
  // -----------------------------------------------------------------

  Widget _buildContextHeader(MiniProgramProvider provider) {
    final aiContext = provider.aiContext;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryLight],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child:
                Icon(aiContext.timeOfDay.icon, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${provider.currentGreeting}!',
                    style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary)),
                const SizedBox(height: 2),
                Text(
                  _buildSubtitle(aiContext),
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _buildSubtitle(AiContext c) {
    if (c.isWeekend) {
      return 'Entspanntes Wochenende · ${c.timeOfDay.label}';
    }
    return '${c.timeOfDay.label} · ${_providerSummary(c)}';
  }

  String _providerSummary(AiContext c) {
    if (c.recentProgramIds.isEmpty) return 'frische Empfehlungen für dich';
    return 'basierend auf deiner Aktivität';
  }

  // -----------------------------------------------------------------
  // Search Bar (semantische Suche)
  // -----------------------------------------------------------------

  Widget _buildSearchBar(MiniProgramProvider provider) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      child: TextField(
        controller: _searchController,
        onChanged: provider.setSearchQuery,
        decoration: InputDecoration(
          hintText: 'z.B. Wetter, Müll, Geld…',
          hintStyle:
              const TextStyle(color: AppColors.textSecondary, fontSize: 14),
          prefixIcon: const Icon(Icons.search,
              color: AppColors.textSecondary, size: 20),
          suffixIcon: provider.searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: () {
                    _searchController.clear();
                    provider.setSearchQuery('');
                  },
                )
              : null,
          filled: true,
          fillColor: AppColors.surface,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }

  // -----------------------------------------------------------------
  // Hero Section (Live-Widget fuer top-bewertetes Programm)
  // -----------------------------------------------------------------

  Widget _buildHeroSection(
      BuildContext context, MiniProgramProvider provider, MiniProgram hero) {
    final live = hero.liveData;
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 8, 20, 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => _launchProgram(context, provider, hero),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(_iconFor(hero.iconPath),
                    color: Colors.white, size: 32),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.star, color: Colors.amberAccent, size: 14),
                        SizedBox(width: 4),
                        Text('FÜR DICH',
                            style: TextStyle(
                                fontSize: 10,
                                color: Colors.white70,
                                letterSpacing: 1.2,
                                fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(hero.name,
                        style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white)),
                    const SizedBox(height: 4),
                    if (live != null && live.value != null)
                      Text('${live.value} · ${live.subtext ?? ""}',
                          style: TextStyle(
                              fontSize: 13,
                              color: Colors.white.withOpacity(0.95)))
                    else
                      Text(hero.description,
                          style: const TextStyle(
                              fontSize: 12, color: Colors.white70),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios,
                  color: Colors.white70, size: 16),
            ],
          ),
        ),
      ),
    );
  }

  // -----------------------------------------------------------------
  // KI-Strip: 4 Empfehlungen (horizontal scrollbar)
  // -----------------------------------------------------------------

  Widget _buildAiStrip(BuildContext context, MiniProgramProvider provider) {
    final recs = provider.recommendedPrograms;
    if (recs.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 6),
          child: Row(
            children: [
              const Icon(Icons.bolt, size: 14, color: AppColors.primary),
              const SizedBox(width: 4),
              Text(
                'KI-Empfehlungen (${recs.length})',
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                    letterSpacing: 0.3),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 134,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: recs.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (ctx, i) =>
                _buildAiStripCard(ctx, provider, recs[i], i),
          ),
        ),
      ],
    );
  }

  Widget _buildAiStripCard(BuildContext context, MiniProgramProvider provider,
      MiniProgram p, int rank) {
    return SizedBox(
      width: 170,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _launchProgram(context, provider, p),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border, width: 0.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    CircleAvatar(
                      radius: 14,
                      backgroundColor: AppColors.primary.withOpacity(0.1),
                      child: Text('#${rank + 1}',
                          style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary)),
                    ),
                    if (p.liveData != null && p.liveData!.isLive)
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: AppColors.success,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Icon(_iconFor(p.iconPath), color: AppColors.primary, size: 22),
                const SizedBox(height: 6),
                Text(p.name,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(
                  p.liveData?.value ?? p.description,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textSecondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // -----------------------------------------------------------------
  // Smart Grid (Restliche Programme)
  // -----------------------------------------------------------------

  Widget _buildSmartGrid(BuildContext context, MiniProgramProvider provider) {
    final programs = provider.remainingPrograms;
    if (programs.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(20),
          child: Text('Keine weiteren Programme verfügbar',
              style: TextStyle(color: AppColors.textSecondary)),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.grid_view, size: 14, color: AppColors.textSecondary),
              SizedBox(width: 4),
              Text('Alle Programme',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary)),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.only(bottom: 24),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.78,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: programs.length,
              itemBuilder: (ctx, i) => SmartProgramCard(
                program: programs[i],
                onTap: () => _launchProgram(context, provider, programs[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // -----------------------------------------------------------------
  // Search Results
  // -----------------------------------------------------------------

  Widget _buildSearchResults(
      BuildContext context, MiniProgramProvider provider) {
    final results = provider.searchResults;
    if (results.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.search_off,
                size: 48, color: AppColors.textSecondary),
            const SizedBox(height: 8),
            Text('Keine Ergebnisse für "${provider.searchQuery}"',
                style: const TextStyle(color: AppColors.textSecondary)),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: GridView.builder(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 0.78,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
        ),
        itemCount: results.length,
        itemBuilder: (ctx, i) => SmartProgramCard(
          program: results[i],
          onTap: () => _launchProgram(context, provider, results[i]),
        ),
      ),
    );
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  void _launchProgram(
      BuildContext context, MiniProgramProvider provider, MiniProgram p) {
    provider.launchProgram(p);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChangeNotifierProvider.value(
          value: provider,
          child: const _MiniProgramViewerWrapper(),
        ),
      ),
    );
  }

  IconData _iconFor(String iconPath) {
    return switch (iconPath) {
      'weather' => Icons.wb_sunny_outlined,
      'air' => Icons.air_outlined,
      'mobility' => Icons.directions_bus_outlined,
      'finance' => Icons.account_balance_wallet_outlined,
      'health' => Icons.local_hospital_outlined,
      'events' => Icons.event_outlined,
      'work' => Icons.work_outline,
      'delete' => Icons.delete_outline,
      'hotel' => Icons.hotel_outlined,
      'domain' => Icons.business_outlined,
      _ => Icons.apps_outlined,
    };
  }
}

// -----------------------------------------------------------------
// Viewer Wrapper (geleitet von hier aus)
// -----------------------------------------------------------------

class _MiniProgramViewerWrapper extends StatelessWidget {
  const _MiniProgramViewerWrapper();

  @override
  Widget build(BuildContext context) {
    return const _MiniProgramViewerScreen();
  }
}

class _MiniProgramViewerScreen extends StatelessWidget {
  const _MiniProgramViewerScreen();

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MiniProgramProvider>();
    final program = provider.activeProgram;
    if (program == null) {
      return const Scaffold(
        body: Center(child: Text('Kein Mini-Programm ausgewählt')),
      );
    }
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(program.name),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            provider.closeProgram();
            Navigator.of(context).pop();
          },
        ),
      ),
      body: MiniProgramContainer(url: program.url, title: program.name),
    );
  }
}
