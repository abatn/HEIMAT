import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state.dart';
import '../prevention_dto.dart';
import 'prevention_provider.dart';

/// PreventionScreen — Profil-basierte Vorsorge-Empfehlungen.
///
/// **Features:**
/// 1. Empfehlungen nach Kategorie/Priorität
/// 2. Empfehlung als erledigt markieren
/// 3. Fortschritt anzeigen
/// 4. Erledigte Empfehlungen
class PreventionScreen extends StatefulWidget {
  const PreventionScreen({super.key});

  @override
  State<PreventionScreen> createState() => _PreventionScreenState();
}

class _PreventionScreenState extends State<PreventionScreen> {
  bool _showCompleted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  void _loadData() {
    final provider = context.read<PreventionProvider>();
    provider.loadRecommendations();
    provider.loadCompleted();
    provider.loadStats();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vorsorge-Empfehlungen'),
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(
              _showCompleted ? Icons.list_outlined : Icons.check_circle_outline,
              size: 20,
            ),
            onPressed: () => setState(() => _showCompleted = !_showCompleted),
            tooltip: _showCompleted ? 'Aktive' : 'Erledigte',
          ),
        ],
      ),
      floatingActionButton: Container(
        height: 52,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: FloatingActionButton.extended(
          onPressed: _generateRecommendations,
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          icon: const Icon(Icons.auto_awesome, size: 20),
          label: const Text('Empfehlungen generieren',
              style: TextStyle(fontWeight: FontWeight.w600)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      body: _showCompleted ? _buildCompletedView() : _buildActiveView(),
    );
  }

  // ====================================================================
  // Active View
  // ====================================================================
  Widget _buildActiveView() {
    return Consumer<PreventionProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading && provider.recommendations.isEmpty) {
          return _buildSkeleton();
        }

        if (provider.recommendations.isEmpty) {
          return _buildEmptyState();
        }

        return Column(
          children: [
            // Stats Header
            if (provider.stats != null) _buildStatsHeader(provider.stats!),

            // Empfehlungen
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async => _loadData(),
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: provider.activeRecommendations.length,
                  itemBuilder: (context, index) {
                    final rec = provider.activeRecommendations[index];
                    return _RecommendationCard(
                      recommendation: rec,
                      onComplete: () => _completeRecommendation(rec),
                    );
                  },
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  // ====================================================================
  // Completed View
  // ====================================================================
  Widget _buildCompletedView() {
    return Consumer<PreventionProvider>(
      builder: (context, provider, _) {
        if (provider.completed.isEmpty) {
          return const Center(
            child: EmptyState(
              icon: Icons.check_circle_outline,
              title: 'Noch keine Empfehlungen erledigt',
              description: 'Markieren Sie Empfehlungen als erledigt.',
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: provider.completed.length,
          itemBuilder: (context, index) {
            final rec = provider.completed[index];
            return _CompletedCard(recommendation: rec);
          },
        );
      },
    );
  }

  // ====================================================================
  // Empty State
  // ====================================================================
  Widget _buildEmptyState() {
    return Center(
      child: EmptyState(
        icon: Icons.health_and_safety_outlined,
        title: 'Noch keine Empfehlungen',
        description:
            'Generieren Sie personalisierte Vorsorge-Empfehlungen basierend auf Ihrem Profil.',
        action: ElevatedButton.icon(
          onPressed: _generateRecommendations,
          icon: const Icon(Icons.auto_awesome, size: 18),
          label: const Text('Empfehlungen generieren'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ),
    );
  }

  // ====================================================================
  // Stats Header
  // ====================================================================
  Widget _buildStatsHeader(PreventionStats stats) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withOpacity(0.06),
            AppColors.primaryLight.withOpacity(0.03),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.12)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              _StatItem(
                label: 'Offen',
                value: '${stats.pending}',
                color: AppColors.warning,
              ),
              _StatItem(
                label: 'Erledigt',
                value: '${stats.completed}',
                color: AppColors.success,
              ),
              _StatItem(
                label: 'Priorität',
                value: '${stats.highPriority}',
                color: AppColors.error,
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Fortschritt
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: stats.progressPercent / 100,
                    backgroundColor: AppColors.border,
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                    minHeight: 8,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${stats.progressPercent}%',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Skeleton
  // ====================================================================
  Widget _buildSkeleton() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 3,
      itemBuilder: (context, index) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 14,
                      width: 120,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 11,
                      width: 80,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ====================================================================
  // Aktionen
  // ====================================================================
  Future<void> _generateRecommendations() async {
    final provider = context.read<PreventionProvider>();
    final newRecs = await provider.generateRecommendations();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            newRecs.isNotEmpty
                ? '${newRecs.length} neue Empfehlungen generiert'
                : 'Keine neuen Empfehlungen',
          ),
          backgroundColor: newRecs.isNotEmpty ? AppColors.success : AppColors.info,
        ),
      );
    }
  }

  Future<void> _completeRecommendation(PreventionRecommendation rec) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Als erledigt markieren?'),
        content: Text('Möchtest Sie "${rec.title}" als erledigt markieren?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Abbrechen'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Erledigt'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final provider = context.read<PreventionProvider>();
      final success = await provider.completeRecommendation(rec.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Als erledigt markiert' : 'Fehler'),
            backgroundColor: success ? AppColors.success : AppColors.error,
          ),
        );
      }
    }
  }
}

// ============================================================================
// Recommendation Card
// ============================================================================

class _RecommendationCard extends StatelessWidget {
  final PreventionRecommendation recommendation;
  final VoidCallback onComplete;

  const _RecommendationCard({
    required this.recommendation,
    required this.onComplete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: recommendation.priority == 'hoch'
              ? Color(recommendation.priorityColor).withOpacity(0.3)
              : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Color(recommendation.priorityColor).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    recommendation.categoryEmoji,
                    style: const TextStyle(fontSize: 22),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      recommendation.title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      recommendation.category,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Color(recommendation.priorityColor).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  recommendation.priorityEmoji,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            recommendation.description,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textPrimary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.info_outline, size: 12, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Text(
                'Basierend auf: ${recommendation.basedOn}',
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: onComplete,
              icon: const Icon(Icons.check, size: 16),
              label: const Text('Als erledigt markieren'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.success,
                side: const BorderSide(color: AppColors.success),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// Completed Card
// ============================================================================

class _CompletedCard extends StatelessWidget {
  final PreventionRecommendation recommendation;

  const _CompletedCard({required this.recommendation});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.success.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.success.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.check_circle,
              color: AppColors.success,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  recommendation.title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
                Text(
                  recommendation.category,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (recommendation.completedAt != null)
            Text(
              _formatDate(recommendation.completedAt!),
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
        ],
      ),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      return '${date.day}.${date.month}.${date.year}';
    } catch (_) {
      return dateStr;
    }
  }
}

// ============================================================================
// Stat Item
// ============================================================================

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
