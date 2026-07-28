import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

/// ComingSoonScreen — Native Placeholder fuer noch nicht implementierte Services.
///
/// **Phase X.1 (Eliminierung IFrame-Einbettung):**
/// Ersetzt das alte `MiniProgramContainer` IFrame-Pattern. Statt externe
/// Webseiten via IFrame einzubetten, zeigt jeder noch nicht migrierte
/// Service eine native "Coming Soon"-Anzeige.
///
/// **Architektur:**
/// - 100% natives Flutter-Widget, kein WebView, kein dart:html, kein IFrame
/// - Aggregiert mit nativen Services via `ServiceRegistry.nativeBuilder`
/// - Service-Metadaten (Name, Description) fliessen direkt aus der Registry
///
/// **User-Regel-Konform:**
/// - KEINE externen Webseiten-Aufrufe (keine IFrame-Embed)
/// - KEINE hardcoded URLs (Service-Daten kommen aus Registry, nicht aus Konstanten)
/// - KEIN Mock, keine Simulation — zeigt nur den Status "Coming Soon"
class ComingSoonScreen extends StatelessWidget {
  final String serviceName;
  final String description;
  final String category;
  final List<String> searchTags;

  const ComingSoonScreen({
    super.key,
    required this.serviceName,
    required this.description,
    required this.category,
    required this.searchTags,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 32),
          Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: Column(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(36),
                  ),
                  child: Icon(
                    Icons.hourglass_top_rounded,
                    size: 36,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  serviceName,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.10),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Coming Soon',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 15,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Text(
                  'Kategorie: $category',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
                if (searchTags.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    alignment: WrapAlignment.center,
                    children: searchTags
                        .take(6)
                        .map(
                          (tag) => Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(8),
                              border:
                                  Border.all(color: AppColors.border, width: 1),
                            ),
                            child: Text(
                              tag,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: const Row(
              children: [
                Icon(Icons.bolt_outlined, size: 20, color: AppColors.primary),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Dieser Service wird in einer kommenden HEIMAT-Phase nativ implementiert. '
                    'HEIMAT vermeidet externe Webseiten-Einbettung per User-Regel '
                    '(siehe project-prompt.md + AGENTS.md).',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
