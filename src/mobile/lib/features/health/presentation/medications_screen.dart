import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state.dart';
import '../health_medications_dto.dart';
import 'health_medications_provider.dart';

/// MedicationsScreen — Medikamentenverwaltung mit Interaktions-Check.
///
/// **Features:**
/// 1. Liste aller Medikamente (aktiv/inaktiv)
/// 2. Neues Medikament hinzufügen (Bottom Sheet)
/// 3. Interaktions-Check (bei ≥2 Medikamenten)
/// 4. Medikament deaktivieren/löschen
class MedicationsScreen extends StatefulWidget {
  final bool isEmbedded;
  const MedicationsScreen({super.key, this.isEmbedded = false});

  @override
  State<MedicationsScreen> createState() => _MedicationsScreenState();
}

class _MedicationsScreenState extends State<MedicationsScreen> {
  bool _showInactive = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<HealthMedicationsProvider>().loadMedications();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isEmbedded) {
      return _buildContent();
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Meine Medikamente'),
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        actions: [
          // Interaktions-Check Button
          Consumer<HealthMedicationsProvider>(
            builder: (context, provider, _) {
              final activeCount = provider.activeMedications.length;
              return IconButton(
                icon: Icon(
                  Icons.warning_amber_outlined,
                  size: 20,
                  color: activeCount >= 2 ? AppColors.warning : AppColors.textSecondary,
                ),
                onPressed: activeCount >= 2
                    ? () => _showInteractionsSheet(context)
                    : null,
                tooltip: 'Interaktions-Check ($activeCount Medikamente)',
              );
            },
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
          onPressed: () => _showAddMedicationSheet(context),
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          icon: const Icon(Icons.add, size: 20),
          label: const Text('Medikament eintragen',
              style: TextStyle(fontWeight: FontWeight.w600)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      body: _buildContent(),
    );
  }

  Widget _buildContent() {
    return Column(
      children: [
        // Interaktions-Warnung (wenn vorhanden)
        _buildInteractionsWarning(),

        // Filter-Leiste
        _buildFilterBar(),

        const Divider(height: 1, color: AppColors.border),

        // Medikamenten-Liste
        Expanded(
          child: Consumer<HealthMedicationsProvider>(
            builder: (context, provider, _) {
              if (provider.isLoading && provider.medications.isEmpty) {
                return _buildSkeleton();
              }
              if (provider.error != null && provider.medications.isEmpty) {
                return SingleChildScrollView(
                  child: Center(
                    child: EmptyState(
                      icon: Icons.error_outline,
                      title: 'Fehler',
                      description: provider.error!,
                      action: ElevatedButton(
                        onPressed: () => provider.loadMedications(),
                        child: const Text('Erneut versuchen'),
                      ),
                    ),
                  ),
                );
              }

              final filtered = _applyFilter(provider.medications);
              if (filtered.isEmpty) {
                return _buildEmptyState();
              }

              return RefreshIndicator(
                onRefresh: () async => provider.loadMedications(),
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final med = filtered[index];
                    return _MedicationCard(
                      medication: med,
                      onDeactivate: () => _deactivateMedication(med),
                      onDelete: () => _deleteMedication(med),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ====================================================================
  // Interaktions-Warnung
  // ====================================================================
  Widget _buildInteractionsWarning() {
    return Consumer<HealthMedicationsProvider>(
      builder: (context, provider, _) {
        final interactions = provider.interactions;
        if (interactions == null || interactions.interactions.isEmpty) {
          return const SizedBox.shrink();
        }

        final severe = interactions.hasSevereInteraction;
        return Container(
          margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: (severe ? AppColors.error : AppColors.warning).withOpacity(0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: (severe ? AppColors.error : AppColors.warning).withOpacity(0.25),
            ),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: (severe ? AppColors.error : AppColors.warning).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.warning_amber,
                  color: severe ? AppColors.error : AppColors.warning,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      severe ? 'Schwerwiegende Interaktion!' : 'Interaktionen gefunden',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: severe ? AppColors.error : AppColors.warning,
                      ),
                    ),
                    Text(
                      '${interactions.interactions.length} Interaktion(en) zwischen Ihren Medikamenten',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: () => _showInteractionsSheet(context),
                child: const Text('Details'),
              ),
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
            icon: Icons.check_circle_outline,
            isSelected: !_showInactive,
            onTap: () => setState(() => _showInactive = false),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Alle',
            icon: Icons.list,
            isSelected: _showInactive,
            onTap: () => setState(() => _showInactive = true),
          ),
          const Spacer(),
          Consumer<HealthMedicationsProvider>(
            builder: (context, provider, _) {
              return Text(
                '${provider.activeCount} aktiv',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Empty State
  // ====================================================================
  Widget _buildEmptyState() {
    return SingleChildScrollView(
      child: Center(
        child: EmptyState(
          icon: Icons.medication_outlined,
          title: 'Noch keine Medikamente eingetragen',
          description:
              'Trage deine Medikamente ein, um Interaktions-Checks durchzuführen und für den Arztbesuch vorbereitet zu sein.',
          action: ElevatedButton.icon(
            onPressed: () => _showAddMedicationSheet(context),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Medikament eintragen'),
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
  // Filter-Logik
  // ====================================================================
  List<UserMedication> _applyFilter(List<UserMedication> medications) {
    if (_showInactive) return medications;
    return medications.where((m) => m.isActive).toList();
  }

  // ====================================================================
  // Aktionen
  // ====================================================================
  Future<void> _deactivateMedication(UserMedication med) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Medikament deaktivieren?'),
        content: Text('Möchtest du "${med.name}" wirklich deaktivieren?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Abbrechen'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Deaktivieren'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final provider = context.read<HealthMedicationsProvider>();
      final success = await provider.removeMedication(med.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Deaktiviert' : 'Fehler'),
            backgroundColor: success ? AppColors.success : AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _deleteMedication(UserMedication med) async {
    // Gleich wie deaktivieren (Backend macht Soft-Delete)
    await _deactivateMedication(med);
  }

  // ====================================================================
  // Bottom Sheet — Neues Medikament
  // ====================================================================
  void _showAddMedicationSheet(BuildContext context) {
    final nameController = TextEditingController();
    final ingredientController = TextEditingController();
    final dosageController = TextEditingController();
    final frequencyController = TextEditingController();
    bool isPrescription = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          height: MediaQuery.of(context).size.height * 0.7,
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
                        Icons.medication_outlined,
                        color: AppColors.primary,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Neues Medikament eintragen',
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
                      // Name (Pflicht)
                      _buildField(
                        controller: nameController,
                        label: 'Name des Medikaments *',
                        icon: Icons.medication,
                      ),
                      const SizedBox(height: 12),

                      // Wirkstoff
                      _buildField(
                        controller: ingredientController,
                        label: 'Wirkstoff (optional)',
                        icon: Icons.science_outlined,
                      ),
                      const SizedBox(height: 12),

                      // Dosierung
                      _buildField(
                        controller: dosageController,
                        label: 'Dosierung (z.B. 500mg)',
                        icon: Icons.straighten,
                      ),
                      const SizedBox(height: 12),

                      // Einnahme
                      _buildField(
                        controller: frequencyController,
                        label: 'Einnahme (z.B. 2x täglich)',
                        icon: Icons.schedule,
                      ),
                      const SizedBox(height: 16),

                      // Rezeptpflichtig
                      Row(
                        children: [
                          Icon(Icons.receipt_outlined,
                              size: 20, color: AppColors.textSecondary),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Text(
                              'Rezeptpflichtig',
                              style: TextStyle(
                                fontSize: 14,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                          Switch(
                            value: isPrescription,
                            onChanged: (val) {
                              setSheetState(() => isPrescription = val);
                            },
                            activeColor: AppColors.primary,
                          ),
                        ],
                      ),
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
                    onPressed: nameController.text.trim().isEmpty
                        ? null
                        : () async {
                            final provider =
                                context.read<HealthMedicationsProvider>();
                            final result = await provider.addMedication(
                              name: nameController.text.trim(),
                              activeIngredient:
                                  ingredientController.text.trim().isEmpty
                                      ? null
                                      : ingredientController.text.trim(),
                              dosage: dosageController.text.trim().isEmpty
                                  ? null
                                  : dosageController.text.trim(),
                              frequency: frequencyController.text.trim().isEmpty
                                  ? null
                                  : frequencyController.text.trim(),
                              isPrescription: isPrescription,
                            );
                            if (mounted) {
                              Navigator.pop(context);
                              if (result != null) {
                                // Interaktionen anzeigen
                                if (result.interactions.interactions.isNotEmpty) {
                                  _showInteractionsDialog(result.interactions);
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Medikament gespeichert'),
                                      backgroundColor: AppColors.success,
                                    ),
                                  );
                                }
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                        provider.error ?? 'Fehler beim Speichern'),
                                    backgroundColor: AppColors.error,
                                  ),
                                );
                              }
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
                      'Medikament speichern',
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
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
      ),
      child: TextField(
        controller: controller,
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
  // Interaktions-Sheet
  // ====================================================================
  void _showInteractionsSheet(BuildContext context) {
    final provider = context.read<HealthMedicationsProvider>();
    final interactions = provider.interactions;

    if (interactions == null || interactions.interactions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Keine Interaktionen gefunden'),
          backgroundColor: AppColors.success,
        ),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.5,
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
                  Icon(
                    interactions.hasSevereInteraction
                        ? Icons.dangerous_outlined
                        : Icons.warning_amber_outlined,
                    color: interactions.hasSevereInteraction
                        ? AppColors.error
                        : AppColors.warning,
                    size: 24,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '${interactions.interactions.length} Interaktion(en) gefunden',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const Divider(height: 1, color: AppColors.border),

            // Interaktions-Liste
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: interactions.interactions.length,
                itemBuilder: (context, index) {
                  final interaction = interactions.interactions[index];
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Color(interaction.severityColor).withOpacity(0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: Color(interaction.severityColor).withOpacity(0.2),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              interaction.severityEmoji,
                              style: const TextStyle(fontSize: 18),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '${interaction.drugA} + ${interaction.drugB}',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: Color(interaction.severityColor),
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: Color(interaction.severityColor)
                                    .withOpacity(0.12),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                interaction.severity,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(interaction.severityColor),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          interaction.description,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Empfehlung: ${interaction.recommendation}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontStyle: FontStyle.italic,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ====================================================================
  // Interaktions-Dialog (nach Hinzufügen)
  // ====================================================================
  void _showInteractionsDialog(MedicationInteractionsResult interactions) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(
              interactions.hasSevereInteraction
                  ? Icons.dangerous_outlined
                  : Icons.warning_amber_outlined,
              color: interactions.hasSevereInteraction
                  ? AppColors.error
                  : AppColors.warning,
            ),
            const SizedBox(width: 8),
            const Text('Interaktionen'),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: interactions.interactions.map((i) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${i.severityEmoji} ${i.drugA} + ${i.drugB}',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: Color(i.severityColor),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(i.description, style: const TextStyle(fontSize: 13)),
                    Text(i.recommendation,
                        style: const TextStyle(
                            fontSize: 12,
                            fontStyle: FontStyle.italic,
                            color: AppColors.textSecondary)),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Verstanden'),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// Medication Card
// ============================================================================

class _MedicationCard extends StatefulWidget {
  final UserMedication medication;
  final VoidCallback onDeactivate;
  final VoidCallback onDelete;

  const _MedicationCard({
    required this.medication,
    required this.onDeactivate,
    required this.onDelete,
  });

  @override
  State<_MedicationCard> createState() => _MedicationCardState();
}

class _MedicationCardState extends State<_MedicationCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final med = widget.medication;

    return GestureDetector(
      onTap: () => setState(() => _isExpanded = !_isExpanded),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: med.isActive
                ? AppColors.border
                : AppColors.textSecondary.withOpacity(0.2),
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
                  // Icon
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: med.isPrescription
                          ? AppColors.info.withOpacity(0.12)
                          : AppColors.primary.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      med.isPrescription
                          ? Icons.receipt_outlined
                          : Icons.medication_outlined,
                      color: med.isPrescription
                          ? AppColors.info
                          : AppColors.primary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Content
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          med.name,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                            decoration:
                                med.isActive ? null : TextDecoration.lineThrough,
                          ),
                        ),
                        if (med.displayName != med.name)
                          Text(
                            med.displayName.replaceAll('${med.name} ', ''),
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                      ],
                    ),
                  ),

                  // Status-Badge
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: med.isActive
                          ? AppColors.success.withOpacity(0.1)
                          : AppColors.textSecondary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      med.isActive ? 'Aktiv' : 'Inaktiv',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: med.isActive
                            ? AppColors.success
                            : AppColors.textSecondary,
                      ),
                    ),
                  ),

                  const SizedBox(width: 4),

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
                    if (med.activeIngredient != null &&
                        med.activeIngredient!.isNotEmpty)
                      _DetailRow(
                        icon: Icons.science_outlined,
                        label: 'Wirkstoff',
                        value: med.activeIngredient!,
                      ),
                    if (med.dosage != null && med.dosage!.isNotEmpty)
                      _DetailRow(
                        icon: Icons.straighten,
                        label: 'Dosierung',
                        value: med.dosage!,
                      ),
                    if (med.frequency != null && med.frequency!.isNotEmpty)
                      _DetailRow(
                        icon: Icons.schedule,
                        label: 'Einnahme',
                        value: med.frequency!,
                      ),
                    if (med.startDate != null)
                      _DetailRow(
                        icon: Icons.calendar_today,
                        label: 'Seit',
                        value: _formatDate(med.startDate!),
                      ),
                    if (med.notes != null && med.notes!.isNotEmpty)
                      _DetailRow(
                        icon: Icons.notes_outlined,
                        label: 'Notizen',
                        value: med.notes!,
                      ),

                    const SizedBox(height: 12),

                    // Aktionen
                    if (med.isActive)
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: widget.onDeactivate,
                          icon: const Icon(Icons.pause_outlined, size: 16),
                          label: const Text('Deaktivieren'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.warning,
                            side: const BorderSide(color: AppColors.warning),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
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
// Detail-Zeile
// ============================================================================

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
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
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
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
