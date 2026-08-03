import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state.dart';
import '../followup_dto.dart';
import 'followup_provider.dart';

/// FollowUpScreen — Post-Termin Follow-up (Nachsorge).
///
/// **Features:**
/// 1. Offene Follow-ups anzeigen
/// 2. Auf Follow-up antworten
/// 3. Verlauf anzeigen
/// 4. Statistiken
class FollowUpScreen extends StatefulWidget {
  final bool isEmbedded;
  const FollowUpScreen({super.key, this.isEmbedded = false});

  @override
  State<FollowUpScreen> createState() => _FollowUpScreenState();
}

class _FollowUpScreenState extends State<FollowUpScreen> {
  bool _showHistory = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  void _loadData() {
    final provider = context.read<FollowUpProvider>();
    provider.loadPending();
    provider.loadHistory();
    provider.loadStats();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isEmbedded) {
      return _buildContent();
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nachsorge'),
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(
              _showHistory ? Icons.inbox_outlined : Icons.history,
              size: 20,
            ),
            onPressed: () => setState(() => _showHistory = !_showHistory),
            tooltip: _showHistory ? 'Offene' : 'Verlauf',
          ),
        ],
      ),
      body: _buildContent(),
    );
  }

  Widget _buildContent() {
    return _showHistory ? _buildHistoryView() : _buildPendingView();
  }

  // ====================================================================
  // Pending View
  // ====================================================================
  Widget _buildPendingView() {
    return Consumer<FollowUpProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading && provider.pendingFollowUps.isEmpty) {
          return _buildSkeleton();
        }

        if (provider.pendingFollowUps.isEmpty) {
          return _buildEmptyState();
        }

        return Column(
          children: [
            // Stats Header
            if (provider.stats != null) _buildStatsHeader(provider.stats!),

            // Due Follow-ups
            if (provider.dueFollowUps.isNotEmpty)
              _buildDueBanner(provider.dueFollowUps.length),

            // Follow-ups
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async => _loadData(),
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: provider.pendingFollowUps.length,
                  itemBuilder: (context, index) {
                    final followUp = provider.pendingFollowUps[index];
                    return _FollowUpCard(
                      followUp: followUp,
                      onRespond: () => _showRespondSheet(followUp),
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
  // History View
  // ====================================================================
  Widget _buildHistoryView() {
    return Consumer<FollowUpProvider>(
      builder: (context, provider, _) {
        if (provider.history.isEmpty) {
          return const Center(
            child: EmptyState(
              icon: Icons.history,
              title: 'Noch keine Nachsorge',
              description: 'Ihre Nachsorge-Antworten werden hier angezeigt.',
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: provider.history.length,
          itemBuilder: (context, index) {
            final followUp = provider.history[index];
            return _HistoryCard(followUp: followUp);
          },
        );
      },
    );
  }

  // ====================================================================
  // Empty State
  // ====================================================================
  Widget _buildEmptyState() {
    return const Center(
      child: EmptyState(
        icon: Icons.check_circle_outline,
        title: 'Keine offenen Follow-ups',
        description:
            'Nach Ihren Arztbesuchen werden Sie automatisch nachgefragt.',
      ),
    );
  }

  // ====================================================================
  // Due Banner
  // ====================================================================
  Widget _buildDueBanner(int count) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warning.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.warning.withOpacity(0.25)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.warning.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.alarm_on,
              color: AppColors.warning,
              size: 20,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$count Follow-up(s) fällig',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.warning,
                  ),
                ),
                const Text(
                  'Bitte antworten Sie auf Ihre Nachsorge-Fragen.',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Stats Header
  // ====================================================================
  Widget _buildStatsHeader(FollowUpStats stats) {
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
      child: Row(
        children: [
          _StatItem(
            label: 'Offen',
            value: '${stats.pending}',
            color: AppColors.warning,
          ),
          _StatItem(
            label: 'Beantwortet',
            value: '${stats.responded}',
            color: AppColors.success,
          ),
          _StatItem(
            label: 'Antwort-Rate',
            value: '${stats.responseRate}%',
            color: AppColors.primary,
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
  // Respond Sheet
  // ====================================================================
  void _showRespondSheet(FollowUp followUp) {
    final textController = TextEditingController();
    int severity = 5;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          height: MediaQuery.of(context).size.height * 0.6,
          decoration: const BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Text(
                      followUp.typeEmoji,
                      style: const TextStyle(fontSize: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Ihre Antwort',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          Text(
                            followUp.typeLabel,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.border),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Text
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: AppColors.surface,
                          border: Border.all(color: AppColors.border),
                        ),
                        child: TextField(
                          controller: textController,
                          maxLines: 4,
                          decoration: const InputDecoration(
                            labelText: 'Wie geht es Ihnen?',
                            hintText: 'Beschreiben Sie Ihr Befinden...',
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.all(16),
                          ),
                          onChanged: (_) => setSheetState(() {}),
                        ),
                      ),

                      const SizedBox(height: 20),

                      // Severity
                      const Text(
                        'Schweregrad',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Text('1',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary)),
                          Expanded(
                            child: Slider(
                              value: severity.toDouble(),
                              min: 1,
                              max: 10,
                              divisions: 9,
                              label: '$severity',
                              activeColor: _severityColor(severity),
                              onChanged: (val) {
                                setSheetState(() => severity = val.round());
                              },
                            ),
                          ),
                          const Text('10',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary)),
                          const SizedBox(width: 8),
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: _severityColor(severity).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Center(
                              child: Text(
                                '$severity',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: _severityColor(severity),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // Submit
              Padding(
                padding: EdgeInsets.fromLTRB(
                  16,
                  0,
                  16,
                  MediaQuery.of(context).viewInsets.bottom + 16,
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: textController.text.trim().isEmpty
                        ? null
                        : () async {
                            final provider = context.read<FollowUpProvider>();
                            final success = await provider.respondToFollowUp(
                              followUpId: followUp.id,
                              text: textController.text.trim(),
                              severity: severity,
                            );
                            if (mounted) {
                              Navigator.pop(context);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    success
                                        ? 'Antwort gespeichert'
                                        : 'Fehler beim Speichern',
                                  ),
                                  backgroundColor: success
                                      ? AppColors.success
                                      : AppColors.error,
                                ),
                              );
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor:
                          AppColors.textSecondary.withOpacity(0.3),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Antwort senden',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _severityColor(int severity) {
    if (severity <= 3) return AppColors.success;
    if (severity <= 6) return AppColors.warning;
    return AppColors.error;
  }
}

// ============================================================================
// FollowUp Card
// ============================================================================

class _FollowUpCard extends StatelessWidget {
  final FollowUp followUp;
  final VoidCallback onRespond;

  const _FollowUpCard({
    required this.followUp,
    required this.onRespond,
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
          color: followUp.isDue
              ? AppColors.warning.withOpacity(0.3)
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
                  color: Color(followUp.statusColor).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    followUp.typeEmoji,
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
                      followUp.typeLabel,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      followUp.countdownLabel,
                      style: TextStyle(
                        fontSize: 12,
                        color: followUp.isDue
                            ? AppColors.warning
                            : AppColors.textSecondary,
                        fontWeight: followUp.isDue
                            ? FontWeight.w600
                            : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Color(followUp.statusColor).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  followUp.statusEmoji,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
          if (followUp.status == 'sent' && !followUp.responded) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onRespond,
                icon: const Icon(Icons.reply, size: 16),
                label: const Text('Antworten'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ============================================================================
// History Card
// ============================================================================

class _HistoryCard extends StatelessWidget {
  final FollowUp followUp;

  const _HistoryCard({required this.followUp});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(followUp.typeEmoji, style: const TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  followUp.typeLabel,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Text(
                followUp.statusEmoji,
                style: const TextStyle(fontSize: 16),
              ),
            ],
          ),
          if (followUp.responseText != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                followUp.responseText!,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
          if (followUp.aiAnalysis != null) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.info.withOpacity(0.06),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome,
                      size: 14, color: AppColors.info),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      followUp.aiAnalysis!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (followUp.respondedAt != null) ...[
            const SizedBox(height: 8),
            Text(
              'Beantwortet am ${_formatDate(followUp.respondedAt!)}',
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ],
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
