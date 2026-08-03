import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state.dart';
import '../health_memory_dto.dart';
import 'health_memory_provider.dart';

/// HealthMemoryScreen — Zeigt den Symptom-Verlauf (Gedächtnis) des Users.
///
/// **Features:**
/// 1. Statistik-Header (aktive/gelöste Symptome, chronische Muster)
/// 2. Timeline-Ansicht mit Triage-Farben
/// 3. Symptom als "gelöst" markieren
/// 4. Neues Symptom hinzufügen (Bottom Sheet)
/// 5. Filter nach Status (aktiv/gelöst/alle)
class HealthMemoryScreen extends StatefulWidget {
  const HealthMemoryScreen({super.key});

  @override
  State<HealthMemoryScreen> createState() => _HealthMemoryScreenState();
}

class _HealthMemoryScreenState extends State<HealthMemoryScreen> {
  _MemoryFilter _selectedFilter = _MemoryFilter.active;
  bool _showStats = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  void _loadData() {
    final provider = context.read<HealthMemoryProvider>();
    provider.loadMemory(limit: 50);
    provider.loadStats();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Symptom-Verlauf'),
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(
              _showStats ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              size: 20,
            ),
            onPressed: () => setState(() => _showStats = !_showStats),
            tooltip: _showStats ? 'Statistiken ausblenden' : 'Statistiken einblenden',
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
          onPressed: _showAddSymptomSheet,
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          icon: const Icon(Icons.add, size: 20),
          label: const Text('Symptom eintragen',
              style: TextStyle(fontWeight: FontWeight.w600)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      body: Column(
        children: [
          // 1. Statistik-Header (optional)
          if (_showStats) _buildStatsHeader(),

          // 2. Filter-Leiste
          _buildFilterBar(),

          const Divider(height: 1, color: AppColors.border),

          // 3. Symptom-Liste
          Expanded(
            child: Consumer<HealthMemoryProvider>(
              builder: (context, provider, _) {
                if (provider.isLoading && provider.memories.isEmpty) {
                  return _buildSkeleton();
                }
                if (provider.error != null && provider.memories.isEmpty) {
                  return SingleChildScrollView(
                    child: Center(
                      child: EmptyState(
                        icon: Icons.error_outline,
                        title: 'Fehler',
                        description: provider.error!,
                        action: ElevatedButton(
                          onPressed: _loadData,
                          child: const Text('Erneut versuchen'),
                        ),
                      ),
                    ),
                  );
                }

                final filtered = _applyFilter(provider.memories);
                if (filtered.isEmpty) {
                  return _buildEmptyState();
                }

                return RefreshIndicator(
                  onRefresh: () async => _loadData(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final entry = filtered[index];
                      return _MemoryCard(
                        entry: entry,
                        onResolve: () => _resolveMemory(entry),
                        onDelete: () => _deleteMemory(entry),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Statistik-Header
  // ====================================================================
  Widget _buildStatsHeader() {
    return Consumer<HealthMemoryProvider>(
      builder: (context, provider, _) {
        final stats = provider.stats;
        if (stats == null) {
          return const SizedBox.shrink();
        }

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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.analytics_outlined,
                      color: AppColors.primary,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Gesundheits-Übersicht',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Statistik-Karten
              Row(
                children: [
                  _StatCard(
                    icon: Icons.active_assistant,
                    label: 'Aktiv',
                    value: '${stats.activeSymptoms}',
                    color: AppColors.warning,
                  ),
                  const SizedBox(width: 8),
                  _StatCard(
                    icon: Icons.check_circle_outline,
                    label: 'Gelöst',
                    value: '${stats.resolvedSymptoms}',
                    color: AppColors.success,
                  ),
                  const SizedBox(width: 8),
                  _StatCard(
                    icon: Icons.summarize_outlined,
                    label: 'Gesamt',
                    value: '${stats.totalEntries}',
                    color: AppColors.info,
                  ),
                ],
              ),

              // Chronische Muster
              if (stats.chronicPatterns.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.warning.withOpacity(0.25)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_outlined,
                          size: 16, color: AppColors.warning),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${stats.chronicPatterns.length} chronische(s) Muster erkannt',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  // ====================================================================
  // Filter-Leiste
  // ====================================================================
  Widget _buildFilterBar() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
      child: Row(
        children: [
          _FilterChip(
            label: 'Aktiv',
            icon: Icons.active_assistant,
            isSelected: _selectedFilter == _MemoryFilter.active,
            onTap: () => setState(() => _selectedFilter = _MemoryFilter.active),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Gelöst',
            icon: Icons.check_circle_outline,
            isSelected: _selectedFilter == _MemoryFilter.resolved,
            onTap: () => setState(() => _selectedFilter = _MemoryFilter.resolved),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Alle',
            icon: Icons.list,
            isSelected: _selectedFilter == _MemoryFilter.all,
            onTap: () => setState(() => _selectedFilter = _MemoryFilter.all),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Empty State
  // ====================================================================
  Widget _buildEmptyState() {
    final hasAnyMemories = context.read<HealthMemoryProvider>().memories.isNotEmpty;

    if (hasAnyMemories) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.filter_list_off,
                size: 48,
                color: AppColors.textSecondary,
              ),
              SizedBox(height: 16),
              Text(
                'Keine Einträge in dieser Kategorie',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Wechsle den Filter oder trage ein neues Symptom ein.',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      child: Center(
        child: EmptyState(
          icon: Icons.healing_outlined,
          title: 'Noch keine Symptome eingetragen',
          description:
              'Trage deine ersten Symptome ein, um einen Verlauf zu erstellen. Das hilft bei der Diagnose und ermöglicht Muster-Erkennung.',
          action: ElevatedButton.icon(
            onPressed: _showAddSymptomSheet,
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Symptom eintragen'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ====================================================================
  // Skeleton Loading
  // ====================================================================
  Widget _buildSkeleton() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 4,
      itemBuilder: (context, index) {
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
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
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
              const SizedBox(height: 12),
              Container(
                height: 11,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ====================================================================
  // Filter-Logik
  // ====================================================================
  List<HealthMemoryEntry> _applyFilter(List<HealthMemoryEntry> memories) {
    switch (_selectedFilter) {
      case _MemoryFilter.active:
        return memories.where((m) => !m.isResolved).toList();
      case _MemoryFilter.resolved:
        return memories.where((m) => m.isResolved).toList();
      case _MemoryFilter.all:
        return memories;
    }
  }

  // ====================================================================
  // Aktionen
  // ====================================================================
  Future<void> _resolveMemory(HealthMemoryEntry entry) async {
    final provider = context.read<HealthMemoryProvider>();
    final success = await provider.resolveMemory(entry.id, doctorVisit: false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(success
              ? 'Symptom als gelöst markiert'
              : 'Fehler beim Aktualisieren'),
          backgroundColor: success ? AppColors.success : AppColors.error,
        ),
      );
    }
  }

  Future<void> _deleteMemory(HealthMemoryEntry entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Eintrag löschen?'),
        content: Text(
            'Möchtest du "${entry.symptomText}" wirklich löschen?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Abbrechen'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Löschen'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final provider = context.read<HealthMemoryProvider>();
      final success = await provider.deleteMemory(entry.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Gelöscht' : 'Fehler beim Löschen'),
            backgroundColor: success ? AppColors.success : AppColors.error,
          ),
        );
      }
    }
  }

  // ====================================================================
  // Bottom Sheet — Neues Symptom
  // ====================================================================
  void _showAddSymptomSheet() {
    final textController = TextEditingController();
    final categoryController = TextEditingController();
    final durationController = TextEditingController();
    int severity = 5;
    String? selectedTriageLevel;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          height: MediaQuery.of(context).size.height * 0.75,
          decoration: const BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.add_circle_outline,
                        color: AppColors.primary,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Neues Symptom eintragen',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
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

              // Form
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Symptom-Text (Pflicht)
                      _buildField(
                        controller: textController,
                        label: 'Beschreibe dein Symptom *',
                        icon: Icons.edit_outlined,
                        maxLines: 3,
                      ),
                      const SizedBox(height: 16),

                      // Kategorie
                      _buildField(
                        controller: categoryController,
                        label: 'Kategorie (z.B. Kopfschmerz, Bauchschmerz)',
                        icon: Icons.category_outlined,
                      ),
                      const SizedBox(height: 16),

                      // Dauer
                      _buildField(
                        controller: durationController,
                        label: 'Dauer (z.B. seit 3 Tagen, seit 2 Wochen)',
                        icon: Icons.schedule_outlined,
                      ),
                      const SizedBox(height: 20),

                      // Schmerzskala
                      const Text(
                        'Schmerzskala',
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
                                  fontSize: 12, color: AppColors.textSecondary)),
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
                                  fontSize: 12, color: AppColors.textSecondary)),
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
                      const SizedBox(height: 20),

                      // Triage-Vorschau
                      if (selectedTriageLevel != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: _triageColor(selectedTriageLevel!)
                                .withOpacity(0.08),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _triageColor(selectedTriageLevel!)
                                  .withOpacity(0.25),
                            ),
                          ),
                          child: Row(
                            children: [
                              Text(
                                _triageEmoji(selectedTriageLevel!),
                                style: const TextStyle(fontSize: 20),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  selectedTriageLevel!,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: _triageColor(selectedTriageLevel!),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ],
                  ),
                ),
              ),

              // Submit Button
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
                            final provider =
                                context.read<HealthMemoryProvider>();
                            final success = await provider.createMemory(
                              symptomText: textController.text.trim(),
                              symptomCategory:
                                  categoryController.text.trim().isEmpty
                                      ? null
                                      : categoryController.text.trim(),
                              severity: severity,
                              duration: durationController.text.trim().isEmpty
                                  ? null
                                  : durationController.text.trim(),
                              triageLevel: selectedTriageLevel,
                            );
                            if (mounted) {
                              Navigator.pop(context);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(success
                                      ? 'Symptom gespeichert'
                                      : 'Fehler beim Speichern'),
                                  backgroundColor:
                                      success ? AppColors.success : AppColors.error,
                                ),
                              );
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: AppColors.textSecondary.withOpacity(0.3),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Symptom speichern',
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

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    int maxLines = 1,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, size: 20),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        onChanged: (_) => setState(() {}),
      ),
    );
  }

  // ====================================================================
  // Helper-Funktionen
  // ====================================================================
  Color _severityColor(int severity) {
    if (severity <= 3) return AppColors.success;
    if (severity <= 6) return AppColors.warning;
    return AppColors.error;
  }

  Color _triageColor(String level) {
    switch (level) {
      case 'NOTFALL':
        return AppColors.error;
      case 'BEREITSCHAFT':
        return AppColors.warning;
      case 'ROUTINE':
        return AppColors.success;
      default:
        return AppColors.textSecondary;
    }
  }

  String _triageEmoji(String level) {
    switch (level) {
      case 'NOTFALL':
        return '🚨';
      case 'BEREITSCHAFT':
        return '⚠️';
      case 'ROUTINE':
        return '🟢';
      default:
        return '❓';
    }
  }
}

// ============================================================================
// Enums
// ============================================================================

enum _MemoryFilter { active, resolved, all }

// ============================================================================
// Statistik-Karte
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
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.15)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
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
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// Filter-Chip
// ============================================================================

class _FilterChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected ? Colors.white : AppColors.textSecondary,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: isSelected ? Colors.white : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// Memory Card — Einzelner Symptom-Eintrag
// ============================================================================

class _MemoryCard extends StatefulWidget {
  final HealthMemoryEntry entry;
  final VoidCallback onResolve;
  final VoidCallback onDelete;

  const _MemoryCard({
    required this.entry,
    required this.onResolve,
    required this.onDelete,
  });

  @override
  State<_MemoryCard> createState() => _MemoryCardState();
}

class _MemoryCardState extends State<_MemoryCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final entry = widget.entry;
    final triageColor = Color(entry.triageColor);

    return GestureDetector(
      onTap: () => setState(() => _isExpanded = !_isExpanded),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: entry.isResolved
                ? AppColors.success.withOpacity(0.3)
                : triageColor.withOpacity(0.2),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  // Triage-Icon
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: triageColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        entry.triageEmoji,
                        style: const TextStyle(fontSize: 22),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Content
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                entry.symptomText,
                                maxLines: _isExpanded ? null : 2,
                                overflow: _isExpanded
                                    ? null
                                    : TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textPrimary,
                                  decoration: entry.isResolved
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                            ),
                            if (entry.severity != null)
                              Container(
                                margin: const EdgeInsets.only(left: 8),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: _severityColor(entry.severity!)
                                      .withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  entry.severityFormatted,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: _severityColor(entry.severity!),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            if (entry.symptomCategory != null) ...[
                              Icon(Icons.category_outlined,
                                  size: 12, color: AppColors.textSecondary),
                              const SizedBox(width: 4),
                              Text(
                                entry.symptomCategory!,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            if (entry.duration != null) ...[
                              Icon(Icons.schedule_outlined,
                                  size: 12, color: AppColors.textSecondary),
                              const SizedBox(width: 4),
                              Text(
                                entry.duration!,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Expand-Icon
                  AnimatedRotation(
                    turns: _isExpanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(
                      Icons.expand_more,
                      color: AppColors.textSecondary,
                      size: 20,
                    ),
                  ),
                ],
              ),
            ),

            // Expanded Details
            if (_isExpanded) ...[
              const Divider(height: 1, color: AppColors.border),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ICD-Codes
                    if (entry.icdCodes != null && entry.icdCodes!.isNotEmpty) ...[
                      _DetailRow(
                        icon: Icons.local_hospital_outlined,
                        label: 'ICD-11',
                        value: entry.icdCodes!.join(', '),
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Triage-Level
                    if (entry.triageLevel != null) ...[
                      _DetailRow(
                        icon: Icons.speed_outlined,
                        label: 'Triage',
                        value: entry.triageLevel!,
                        valueColor: triageColor,
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Medikamente
                    if (entry.medicationsUsed != null &&
                        entry.medicationsUsed!.isNotEmpty) ...[
                      _DetailRow(
                        icon: Icons.medication_outlined,
                        label: 'Medikamente',
                        value: entry.medicationsUsed!.join(', '),
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Wetter
                    if (entry.weatherCondition != null) ...[
                      _DetailRow(
                        icon: Icons.wb_sunny_outlined,
                        label: 'Wetter',
                        value: entry.weatherCondition!,
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Status
                    _DetailRow(
                      icon: entry.isResolved
                          ? Icons.check_circle_outline
                          : Icons.radio_button_unchecked,
                      label: 'Status',
                      value: entry.isResolved ? 'Gelöst' : 'Aktiv',
                      valueColor: entry.isResolved
                          ? AppColors.success
                          : AppColors.warning,
                    ),

                    const SizedBox(height: 12),

                    // Aktionen
                    Row(
                      children: [
                        if (!entry.isResolved)
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: widget.onResolve,
                              icon: const Icon(Icons.check, size: 16),
                              label: const Text('Als gelöst markieren'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.success,
                                side: const BorderSide(color: AppColors.success),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ),
                        if (!entry.isResolved) const SizedBox(width: 8),
                        IconButton(
                          onPressed: widget.onDelete,
                          icon: const Icon(Icons.delete_outline, size: 20),
                          color: AppColors.error,
                          tooltip: 'Löschen',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],

            // Timestamp (immer sichtbar)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
              child: Text(
                _formatDate(entry.createdAt),
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _severityColor(int severity) {
    if (severity <= 3) return AppColors.success;
    if (severity <= 6) return AppColors.warning;
    return AppColors.error;
  }

  String _formatDate(String isoDate) {
    try {
      final date = DateTime.parse(isoDate);
      final now = DateTime.now();
      final diff = now.difference(date);

      if (diff.inDays == 0) return 'Heute';
      if (diff.inDays == 1) return 'Gestern';
      if (diff.inDays < 7) return 'Vor ${diff.inDays} Tagen';
      return '${date.day}.${date.month}.${date.year}';
    } catch (_) {
      return isoDate;
    }
  }
}

// ============================================================================
// Detail-Zeile
// ============================================================================

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.textSecondary,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: valueColor ?? AppColors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
