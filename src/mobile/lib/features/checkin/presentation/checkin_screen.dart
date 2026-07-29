import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state.dart';
import 'checkin_provider.dart';
import '../checkin_dto.dart';

/// CheckinScreen — "Lebenszeichen" Check-in UI (Phase AI-Health-3, 2026-07-29).
///
/// **Design-Prinzip:**
/// - Beruhigend, freundlich, grün — kein Alarm-Design
/// - Große Tap-Ziele für ältere Nutzer
/// - Privacy-first: erklärt was NICHT getrackt wird
/// - Disclaimer immer sichtbar
class CheckinScreen extends StatefulWidget {
  const CheckinScreen({super.key});

  @override
  State<CheckinScreen> createState() => _CheckinScreenState();
}

class _CheckinScreenState extends State<CheckinScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  bool _showSettings = false;
  int _intervalHours = 24;
  int _healthIntervalHours = 6;
  bool _auto112 = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<CheckinProvider>();
      p.refreshStatus();
      p.loadSettings().then((_) {
        // Settings nachladen für Slider/Initialwerte
        final s = p.settings;
        if (s != null && mounted) {
          setState(() {
            _intervalHours = s.intervalHours;
            _healthIntervalHours = s.intervalHealthHours;
            _auto112 = s.auto112Enabled;
            if (s.emergencyContactName != null) {
              _nameController.text = s.emergencyContactName!;
            }
            if (s.emergencyContactPhone != null) {
              _phoneController.text = s.emergencyContactPhone!;
            }
            if (s.emergencyContactEmail != null) {
              _emailController.text = s.emergencyContactEmail!;
            }
          });
        }
      });
      p.loadEvents();
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<CheckinProvider>(
        builder: (context, provider, _) {
          return RefreshIndicator(
            onRefresh: () async {
              await provider.refreshStatus();
              await provider.loadSettings();
              await provider.loadEvents();
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ===== Header =====
                  _buildHeader(provider),

                  const SizedBox(height: 16),

                  // ===== Disclaimer =====
                  _buildDisclaimer(),

                  const SizedBox(height: 16),

                  // ===== Activation Section =====
                  _buildActivationCard(provider),

                  const SizedBox(height: 16),

                  // ===== Active Content =====
                  if (provider.isActive) ...[
                    _buildPingCard(provider),
                    const SizedBox(height: 16),
                    _buildEscalationCard(provider),
                    const SizedBox(height: 16),
                    _buildEmergencyContactCard(provider),
                    const SizedBox(height: 16),
                    _buildSettingsSection(provider),
                    const SizedBox(height: 16),
                    if (provider.events.isNotEmpty)
                      _buildEventsTimeline(provider),
                  ],

                  // ===== Error =====
                  if (provider.error != null && !provider.isActive)
                    _buildErrorCard(provider.error!),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ====================================================================
  // Header
  // ====================================================================
  Widget _buildHeader(CheckinProvider provider) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary,
            AppColors.primaryLight,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.verified_user_outlined,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Lebenszeichen',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Täglicher Check-in für deine Sicherheit',
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (!provider.isActive)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.info_outline, size: 16, color: Colors.white),
                  SizedBox(width: 6),
                  Text(
                    'Nicht aktiv — Zum Schutz aktivieren',
                    style: TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  // ====================================================================
  // Disclaimer
  // ====================================================================
  Widget _buildDisclaimer() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warning.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withOpacity(0.15)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline,
              size: 18, color: AppColors.warning.withOpacity(0.8)),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Kein medizinischer Notdienst. '
              'Bei akuten Notfällen immer 112 wählen.',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Activation Card
  // ====================================================================
  Widget _buildActivationCard(CheckinProvider provider) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: provider.isActive
                        ? [AppColors.success, AppColors.primaryLight]
                        : [AppColors.textSecondary, AppColors.border],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: provider.isActive
                      ? [
                          BoxShadow(
                            color: AppColors.success.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ]
                      : [],
                ),
                child: Icon(
                  provider.isActive
                      ? Icons.shield_outlined
                      : Icons.shield_outlined,
                  color: Colors.white,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      provider.isActive
                          ? 'Check-in aktiv'
                          : 'Check-in aktivieren',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      provider.isActive
                          ? 'Du erhältst täglich eine Erinnerung'
                          : 'Aktivieren für tägliche Sicherheits-Checks',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Switch(
                value: provider.isActive,
                onChanged: provider.isLoading
                    ? null
                    : (val) async {
                        if (val) {
                          await provider.activate();
                          await provider.loadSettings();
                        } else {
                          await provider.deactivate();
                        }
                      },
                activeColor: AppColors.primary,
              ),
            ],
          ),

          // Quick-Info wenn aktiv
          if (provider.isActive && provider.status != null) ...[
            const Divider(height: 24, color: AppColors.border),
            _buildStatusRow(
              Icons.timer_outlined,
              'Intervall',
              'Alle ${provider.status!.currentIntervalHours ?? 24} Stunden',
            ),
            const SizedBox(height: 6),
            _buildStatusRow(
              Icons.schedule_outlined,
              'Letzter Ping',
              provider.status!.timeSinceLastPingMinutes != null
                  ? 'Vor ${provider.status!.timeSinceLastPingMinutes} Min'
                  : 'Noch kein Ping',
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatusRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Text(label,
            style: const TextStyle(
                fontSize: 13, color: AppColors.textSecondary)),
        const Spacer(),
        Text(value,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary)),
      ],
    );
  }

  // ====================================================================
  // Ping Button — "Mir geht's gut!"
  // ====================================================================
  Widget _buildPingCard(CheckinProvider provider) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.success.withOpacity(0.08),
            AppColors.primary.withOpacity(0.03),
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.success.withOpacity(0.15)),
      ),
      child: Column(
        children: [
          const Text(
            'Alles okay bei dir?',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Drücke den Button, um zu bestätigen dass es dir gut geht.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary.withOpacity(0.8),
            ),
          ),
          const SizedBox(height: 20),

          // ===== GROSSER PING-BUTTON =====
          GestureDetector(
            onTapDown: provider.isLoading ? null : (_) {},
            onTapUp: provider.isLoading
                ? null
                : (_) async {
                    await provider.ping();
                  },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.primaryLight],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.4),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: provider.isLoading
                  ? const Center(
                      child: SizedBox(
                        width: 32,
                        height: 32,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 3,
                        ),
                      ),
                    )
                  : const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.favorite, color: Colors.white, size: 40),
                        SizedBox(height: 8),
                        Text(
                          'Mir geht\'s\ngut!',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            height: 1.2,
                          ),
                        ),
                      ],
                    ),
            ),
          ),

          // ===== Letzter Ping =====
          if (provider.lastPingResult != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.success.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_outline,
                      size: 16, color: AppColors.success),
                  SizedBox(width: 6),
                  Text(
                    'Bestätigt — Timer zurückgesetzt',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.success,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ====================================================================
  // Escalation Stage
  // ====================================================================
  Widget _buildEscalationCard(CheckinProvider provider) {
    final stage = provider.status?.escalationStage ?? 0;
    final desc = CheckinProvider.escalationDescription(stage);

    Color stageColor;
    IconData stageIcon;
    switch (stage) {
      case 0:
        stageColor = AppColors.success;
        stageIcon = Icons.check_circle;
      case 1:
        stageColor = AppColors.warning;
        stageIcon = Icons.access_time;
      case 2:
        stageColor = AppColors.warning;
        stageIcon = Icons.notifications_active;
      case 3:
        stageColor = AppColors.error;
        stageIcon = Icons.contact_emergency;
      case 4:
        stageColor = AppColors.error;
        stageIcon = Icons.emergency;
      default:
        stageColor = AppColors.textSecondary;
        stageIcon = Icons.help_outline;
    }

    return Container(
      width: double.infinity,
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
              Icon(stageIcon, size: 20, color: stageColor),
              const SizedBox(width: 8),
              const Text(
                'Status',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Stage indicator bar
          Row(
            children: List.generate(5, (i) {
              final isReached = i <= stage;
              return Expanded(
                child: Container(
                  height: 4,
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(2),
                    color: isReached ? stageColor : AppColors.border,
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(5, (i) {
              return Text(
                '$i',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight:
                      i == stage ? FontWeight.w600 : FontWeight.normal,
                  color: i == stage ? stageColor : AppColors.textSecondary,
                ),
              );
            }),
          ),
          const SizedBox(height: 10),
          Text(
            desc,
            style: TextStyle(
              fontSize: 13,
              color: stageColor,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Emergency Contact
  // ====================================================================
  Widget _buildEmergencyContactCard(CheckinProvider provider) {
    final settings = provider.settings;

    return Container(
      width: double.infinity,
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
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.info.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.contact_emergency_outlined,
                    size: 20, color: AppColors.info),
              ),
              const SizedBox(width: 10),
              const Text(
                'Notfallkontakt',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (settings?.emergencyContactName != null) ...[
            _buildContactRow(Icons.person_outline,
                settings!.emergencyContactName!),
            const SizedBox(height: 6),
            if (settings.emergencyContactPhone != null)
              _buildContactRow(
                  Icons.phone_outlined, settings.emergencyContactPhone!),
            if (settings.emergencyContactEmail != null) ...[
              const SizedBox(height: 6),
              _buildContactRow(
                  Icons.email_outlined, settings.emergencyContactEmail!),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  settings.auto112Enabled
                      ? Icons.check_circle_outline
                      : Icons.cancel_outlined,
                  size: 16,
                  color: settings.auto112Enabled
                      ? AppColors.success
                      : AppColors.textSecondary,
                ),
                const SizedBox(width: 6),
                Text(
                  settings.auto112Enabled
                      ? '112-Benachrichtigung aktiviert'
                      : '112-Benachrichtigung deaktiviert',
                  style: TextStyle(
                    fontSize: 12,
                    color: settings.auto112Enabled
                        ? AppColors.success
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ] else ...[
            const Text(
              'Kein Notfallkontakt hinterlegt.',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: () => _showContactSheet(provider),
              icon: const Icon(Icons.add_circle_outline, size: 18),
              label: const Text('Notfallkontakt hinterlegen'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildContactRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textPrimary)),
        ),
      ],
    );
  }

  // ====================================================================
  // Settings
  // ====================================================================
  Widget _buildSettingsSection(CheckinProvider provider) {
    final settings = provider.settings;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _showSettings = !_showSettings),
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.tune_outlined,
                        size: 20, color: AppColors.primary),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Einstellungen',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  AnimatedRotation(
                    turns: _showSettings ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(Icons.expand_more,
                        color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ),
          if (_showSettings) ...[
            const Divider(height: 1, color: AppColors.border),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Check-in Intervall (Stunden)',
                      style: TextStyle(
                          fontSize: 13, color: AppColors.textSecondary)),
                  const SizedBox(height: 4),
                  Text('$intervalHours h',
                      style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary)),
                  Slider(
                    value: _intervalHours.toDouble(),
                    min: 6,
                    max: 48,
                    divisions: 7,
                    activeColor: AppColors.primary,
                    label: '$_intervalHours h',
                    onChanged: settings != null
                        ? (v) => setState(() => _intervalHours = v.round())
                        : null,
                    onChangeEnd: (v) async {
                      await provider.updateSettings(
                          intervalHours: v.round());
                    },
                  ),
                  const Text('Gesundheits-Intervall (Stunden)',
                      style: TextStyle(
                          fontSize: 13, color: AppColors.textSecondary)),
                  const SizedBox(height: 4),
                  Text('$_healthIntervalHours h',
                      style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary)),
                  Slider(
                    value: _healthIntervalHours.toDouble(),
                    min: 2,
                    max: 24,
                    divisions: 11,
                    activeColor: AppColors.info,
                    label: '$_healthIntervalHours h',
                    onChanged: settings != null
                        ? (v) => setState(
                            () => _healthIntervalHours = v.round())
                        : null,
                    onChangeEnd: (v) async {
                      await provider.updateSettings(
                          intervalHealthHours: v.round());
                    },
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Text('112-Benachrichtigung',
                          style: TextStyle(
                              fontSize: 14,
                              color: AppColors.textPrimary)),
                      const Spacer(),
                      Switch(
                        value: _auto112,
                        onChanged: settings != null
                            ? (v) {
                                setState(() => _auto112 = v);
                                provider.updateSettings(
                                    auto112Enabled: v);
                              }
                            : null,
                        activeColor: AppColors.error,
                      ),
                    ],
                  ),
                  const Text(
                    'Wenn aktiviert, kann im äußersten Notfall '
                    'der Rettungsdienst (112) benachrichtigt werden.',
                    style: TextStyle(
                        fontSize: 11, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ====================================================================
  // Events Timeline
  // ====================================================================
  Widget _buildEventsTimeline(CheckinProvider provider) {
    return Container(
      width: double.infinity,
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
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.history_outlined,
                    size: 20, color: AppColors.primary),
              ),
              const SizedBox(width: 10),
              const Text(
                'Verlauf',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...provider.events.take(10).map((event) {
            IconData evIcon;
            Color evColor;
            String evLabel;

            switch (event.eventType) {
              case 'activated':
                evIcon = Icons.power_settings_new;
                evColor = AppColors.success;
                evLabel = 'Aktiviert';
              case 'deactivated':
                evIcon = Icons.power_off;
                evColor = AppColors.textSecondary;
                evLabel = 'Deaktiviert';
              case 'ping':
                evIcon = Icons.favorite;
                evColor = AppColors.primary;
                evLabel = 'Check-in';
              case 'missed':
                evIcon = Icons.access_time;
                evColor = AppColors.warning;
                evLabel = 'Verpasst';
              case 'escalated':
                evIcon = Icons.warning_amber;
                evColor = AppColors.error;
                evLabel = 'Eskaliert (Stufe ${event.escalationStage})';
              default:
                evIcon = Icons.circle;
                evColor = AppColors.textSecondary;
                evLabel = event.eventType;
            }

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 2),
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: evColor.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(evIcon, size: 14, color: evColor),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(evLabel,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textPrimary)),
                        if (event.details != null &&
                            event.details!.isNotEmpty)
                          Text(event.details!,
                              style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  Text(
                    _formatDate(event.createdAt),
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textSecondary),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    if (iso.length >= 16) {
      return iso.substring(11, 16);
    }
    return iso;
  }

  // ====================================================================
  // Error Card
  // ====================================================================
  Widget _buildErrorCard(String errorText) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.error.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withOpacity(0.15)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, size: 20, color: AppColors.error),
          const SizedBox(width: 10),
          Expanded(
            child: Text(errorText,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.error)),
          ),
        ],
      ),
    );
  }

  // ====================================================================
  // Contact Sheet
  // ====================================================================
  void _showContactSheet(CheckinProvider provider) {
    // Controller zurücksetzen beim Öffnen
    _nameController.clear();
    _phoneController.clear();
    _emailController.clear();
    if (provider.settings != null) {
      final s = provider.settings!;
      _nameController.text = s.emergencyContactName ?? '';
      _phoneController.text = s.emergencyContactPhone ?? '';
      _emailController.text = s.emergencyContactEmail ?? '';
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            20 + MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Notfallkontakt hinzufügen',
                style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              _buildSheetField(
                  _nameController, 'Name', Icons.person_outline),
              const SizedBox(height: 12),
              _buildSheetField(
                  _phoneController, 'Telefon', Icons.phone_outlined,
                  keyboardType: TextInputType.phone),
              const SizedBox(height: 12),
              _buildSheetField(
                  _emailController, 'E-Mail (optional)',
                  Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Text('112-Benachrichtigung erlauben',
                      style: TextStyle(
                          fontSize: 14, color: AppColors.textPrimary)),
                  const Spacer(),
                  Switch(
                    value: _auto112,
                    onChanged: (v) =>
                        setState(() => _auto112 = v),
                    activeColor: AppColors.error,
                  ),
                ],
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(ctx);
                    await provider.activate(
                      emergencyContactName:
                          _nameController.text.trim(),
                      emergencyContactPhone:
                          _phoneController.text.trim(),
                      emergencyContactEmail:
                          _emailController.text.trim(),
                      auto112Enabled: _auto112,
                    );
                    await provider.loadSettings();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Aktivieren & Speichern',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSheetField(TextEditingController ctrl, String label,
      IconData icon,
      {TextInputType? keyboardType}) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
      ),
      child: TextField(
        controller: ctrl,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        keyboardType: keyboardType,
      ),
    );
  }
}
