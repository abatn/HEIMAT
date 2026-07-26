import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/skeleton_loader.dart';
import 'home_provider.dart';

// ============================================================================
// AI-Home Dashboard — personalisierte Startseite mit Zeitkontext
// ============================================================================

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();

    // Dashboard laden wenn noch nicht geladen
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<HomeProvider>();
      if (!provider.isLoading && provider.context == null) {
        provider.loadDashboard();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<HomeProvider>(
      builder: (context, home, _) {
        if (home.isLoading && home.context == null) {
          return _buildLoading();
        }
        return RefreshIndicator(
          onRefresh: () => home.loadDashboard(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              const SizedBox(height: 4),
              _buildGreetingCard(home),
              const SizedBox(height: 16),
              _buildQuickStats(home),
              const SizedBox(height: 20),
              _buildQuickActions(home),
              const SizedBox(height: 20),
              _buildSuggestionsSection(home),
            ],
          ),
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // Loading-State
  // --------------------------------------------------------------------------

  Widget _buildLoading() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SkeletonLoader(width: 280, height: 24, borderRadius: 8),
          SizedBox(height: 12),
          SkeletonLoader(width: 200, height: 16, borderRadius: 8),
          SizedBox(height: 32),
          SkeletonLoader(width: double.infinity, height: 120, borderRadius: 16),
          SizedBox(height: 16),
          SkeletonLoader(width: double.infinity, height: 80, borderRadius: 16),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // Greeting Card — animiert, mit Tageszeit + Username
  // --------------------------------------------------------------------------

  Widget _buildGreetingCard(HomeProvider home) {
    final context = home.context;
    if (context == null) return const SizedBox.shrink();

    final isWeekend = context.isWeekend;
    final isMorning = context.timeOfDay == 'morning';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isMorning
              ? [const Color(0xFFFF8F00), AppColors.primary]
              : isWeekend
                  ? [const Color(0xFF7C4DFF), const Color(0xFF448AFF)]
                  : [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: (isMorning ? const Color(0xFFFF8F00) : AppColors.primary)
                .withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Emoji + Greeting
          Row(
            children: [
              Text(
                isMorning
                    ? '🌅'
                    : isWeekend
                        ? '🎉'
                        : '👋',
                style: const TextStyle(fontSize: 28),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,                    children: [
                    Text(
                      '${context.greeting}, ${home.userName}!',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    if (isWeekend)
                      const Text(
                        'Schönes Wochenende!',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white70,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Optional: Location + Nearby Info
          if (home.currentLocation != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.gps_fixed, size: 14, color: Colors.white70),
                  const SizedBox(width: 6),
                  Text(
                    'Standort aktiv',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white.withOpacity(0.8),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 12),
          // Week indicator
          Text(
            _getDayGreeting(context.dayOfWeek),
            style: const TextStyle(
              fontSize: 13,
              color: Colors.white70,
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // Quick Stats — kleine Karten mit Zusammenfassungen
  // --------------------------------------------------------------------------

  Widget _buildQuickStats(HomeProvider home) {
    final nearby = home.nearbySummary;
    final hasLocation = nearby != null;

    return Row(
      children: [
        Expanded(
          child: _StatCard(
            icon: Icons.directions_bus_outlined,
            label: 'Haltestellen',
            value: hasLocation ? '${nearby!.stopsNearby}' : '—',
            color: AppColors.primary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            icon: Icons.local_hospital_outlined,
            label: 'Ärzte',
            value: hasLocation ? '${nearby.doctorsNearby}' : '—',
            color: AppColors.error,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            icon: Icons.account_balance_wallet_outlined,
            label: 'KUDOS',
            value: '—', // Später dynamisch aus Wallet
            color: AppColors.secondary,
          ),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // Quick Actions — 4 Buttons für Schnellzugriff
  // --------------------------------------------------------------------------

  Widget _buildQuickActions(HomeProvider home) {
    final context = home.context;
    if (context == null) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 12),
          child: Row(
            children: [
              const Icon(Icons.bolt, size: 18, color: AppColors.secondary),
              const SizedBox(width: 6),
              Text(
                'Schnellzugriff',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
        Row(
          children: context.quickActions.map((action) {
            return Expanded(
              child: _QuickActionButton(
                icon: action.icon,
                label: action.label,
                onTap: () {
                  // TODO: Tab-Wechsel via MainScreen-Callback
                  // Aktuell: User navigiert via Bottom-Navigation-Bar
                },
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // AI Suggestions — Kontextualisierte Vorschläge vom Backend
  // --------------------------------------------------------------------------

  Widget _buildSuggestionsSection(HomeProvider home) {
    final context = home.context;
    if (context == null || context.suggestions.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 12),
          child: Row(
            children: [
              Icon(Icons.auto_awesome, size: 18, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                'AI-Vorschläge',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
        ...context.suggestions.map((suggestion) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _SuggestionCard(suggestion: suggestion),
          );
        }),
      ],
    );
  }

  String _getDayGreeting(int day) {
    switch (day) {
      case 1:
        return 'Starte gut in die neue Woche! 🚀';
      case 2:
        return 'Dienstag — voller Energie! ⚡';
      case 3:
        return 'Mittwoch — Bergfest! 🏔️';
      case 4:
        return 'Donnerstag — fast da! 💪';
      case 5:
        return 'Freitag — Wochenende naht! 🎉';
      case 6:
        return 'Samstag — genieße den Tag! 🌞';
      case 7:
        return 'Sonntag — entspanne dich! 🌿';
      default:
        return 'Schönen Tag!';
    }
  }
}

// ============================================================================
// Sub-Widgets
// ============================================================================

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final String icon;
  final String label;
  final VoidCallback? onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Material(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(icon, style: const TextStyle(fontSize: 24)),
                const SizedBox(height: 6),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SuggestionCard extends StatelessWidget {
  final Suggestion suggestion;

  const _SuggestionCard({required this.suggestion});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                suggestion.icon,
                style: const TextStyle(fontSize: 22),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  suggestion.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  suggestion.description,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Icon(
            Icons.arrow_forward_ios,
            size: 14,
            color: AppColors.textSecondary.withOpacity(0.5),
          ),
        ],
      ),
    );
  }
}
