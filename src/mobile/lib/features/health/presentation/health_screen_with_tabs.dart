import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/location_service.dart';
import '../../ai_chat/presentation/ai_chat_provider.dart';
import '../../checkin/presentation/checkin_provider.dart';
import 'health_provider.dart';
import 'health_memory_provider.dart';
import 'health_medications_provider.dart';
import 'mental_health_provider.dart';
import 'prevention_provider.dart';
import 'followup_provider.dart';
import 'health_memory_screen.dart';
import 'medications_screen.dart';
import 'mental_health_screen.dart';
import 'prevention_screen.dart';
import 'followup_screen.dart';

/// HealthScreenWithTabs — Erweiterter HealthScreen mit Tabs für Phase 1+2.
///
/// **Tabs:**
/// 1. Ärzte (bestehende Funktion)
/// 2. Verlauf (Gedächtnis)
/// 3. Medikamente
/// 4. Mental Health (PHQ-9)
/// 5. Prävention
/// 6. Nachsorge
class HealthScreenWithTabs extends StatefulWidget {
  const HealthScreenWithTabs({super.key});

  @override
  State<HealthScreenWithTabs> createState() => _HealthScreenWithTabsState();
}

class _HealthScreenWithTabsState extends State<HealthScreenWithTabs>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 6, vsync: this);
    _tabController.addListener(_onTabChanged);
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;

    // Provider beim Tab-Wechsel laden
    final index = _tabController.index;
    switch (index) {
      case 1: // Verlauf
        context.read<HealthMemoryProvider>().loadMemory();
        context.read<HealthMemoryProvider>().loadStats();
        break;
      case 2: // Medikamente
        context.read<HealthMedicationsProvider>().loadMedications();
        break;
      case 3: // Mental Health
        context.read<MentalHealthProvider>().loadHistory();
        context.read<MentalHealthProvider>().loadStats();
        break;
      case 4: // Prävention
        context.read<PreventionProvider>().loadRecommendations();
        context.read<PreventionProvider>().loadStats();
        break;
      case 5: // Nachsorge
        context.read<FollowUpProvider>().loadPending();
        context.read<FollowUpProvider>().loadStats();
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Gesundheit'),
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          labelStyle: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(icon: Icon(Icons.local_hospital, size: 20), text: 'Ärzte'),
            Tab(icon: Icon(Icons.timeline, size: 20), text: 'Verlauf'),
            Tab(icon: Icon(Icons.medication, size: 20), text: 'Medikamente'),
            Tab(icon: Icon(Icons.psychology, size: 20), text: 'Mental'),
            Tab(
                icon: Icon(Icons.health_and_safety, size: 20),
                text: 'Vorsorge'),
            Tab(
                icon: Icon(Icons.follow_the_signs, size: 20),
                text: 'Nachsorge'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 0: Ärzte (bestehende Funktion)
          const _DoctorsTab(),

          // Tab 1: Verlauf (Gedächtnis)
          const HealthMemoryScreen(isEmbedded: true),

          // Tab 2: Medikamente
          const MedicationsScreen(isEmbedded: true),

          // Tab 3: Mental Health
          const MentalHealthScreen(isEmbedded: true),

          // Tab 4: Prävention
          const PreventionScreen(isEmbedded: true),

          // Tab 5: Nachsorge
          const FollowUpScreen(isEmbedded: true),
        ],
      ),
    );
  }
}

// ============================================================================
// Ärzte Tab (volle Funktionalität aus health_screen.dart)
// ============================================================================

class _DoctorsTab extends StatefulWidget {
  const _DoctorsTab();

  @override
  State<_DoctorsTab> createState() => _DoctorsTabState();
}

class _DoctorsTabState extends State<_DoctorsTab> {
  String _selectedSpecialty = '';
  bool _showAiChat = false;
  final TextEditingController _aiChatController = TextEditingController();

  static const _specialties = [
    ('', 'Alle', Icons.local_hospital),
    ('Allgemeinmedizin', 'Hausarzt', Icons.medical_services),
    ('Zahnarzt', 'Zahnarzt', Icons.medical_services),
    ('Augenarzt', 'Augenarzt', Icons.remove_red_eye),
    ('HNO-Arzt', 'HNO', Icons.hearing),
    ('Hautarzt', 'Hautarzt', Icons.face),
    ('Kinderarzt', 'Kinder', Icons.child_care),
    ('Frauenarzt', 'Frauen', Icons.pregnant_woman),
    ('Kardiologe', 'Herz', Icons.favorite),
    ('Orthopäde', 'Orthopäde', Icons.accessibility_new),
    ('Neurologe', 'Neuro', Icons.psychology),
    ('Psychotherapeut', 'Psyche', Icons.psychology_alt),
    ('Urologe', 'Uro', Icons.water_drop),
    ('Pneumologie', 'Lunge', Icons.air),
    ('Chirurg', 'Chirurg', Icons.content_cut),
    ('Innere Medizin', 'Innere', Icons.monitor_heart),
    ('Sportmedizin', 'Sport', Icons.directions_run),
    ('Radiologie', 'Röntgen', Icons.radio),
    ('Physiotherapie', 'Physio', Icons.directions_walk),
    ('Allergologie', 'Allergie', Icons.bug_report),
    ('Naturheilkunde', 'Natur', Icons.spa),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadLocationAndRefresh();
    });
  }

  @override
  void dispose() {
    _aiChatController.dispose();
    super.dispose();
  }

  Future<void> _loadLocationAndRefresh() async {
    final location = await LocationService.getCurrentLocation();
    if (mounted && location != null) {
      context.read<HealthProvider>().searchDoctors(
            lat: location.latitude,
            lng: location.longitude,
          );
      context.read<AiChatProvider>().setLocation(
            location.latitude,
            location.longitude,
          );
    }
  }

  void _sendAiChatMessage(String text) {
    if (text.trim().isEmpty) return;
    _aiChatController.clear();
    context.read<AiChatProvider>().sendMessage(text, includeWeather: false);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // AI Health Chat Header
        _buildAiHealthHeader(),

        // Termin-Erinnerung Banner
        _buildAppointmentReminderBanner(),

        // Lebenszeichen Status
        _buildLebenszeichenStatus(),

        // Filter chips row
        Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: SizedBox(
            height: 42,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _specialties.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final (value, label, icon) = _specialties[index];
                final isSelected = _selectedSpecialty == value;
                return FilterChip(
                  label: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon,
                          size: 16,
                          color: isSelected
                              ? Colors.white
                              : AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Text(label),
                    ],
                  ),
                  selected: isSelected,
                  selectedColor: AppColors.primary,
                  backgroundColor: AppColors.card,
                  checkmarkColor: Colors.white,
                  showCheckmark: false,
                  side: BorderSide(
                    color: isSelected ? AppColors.primary : AppColors.border,
                  ),
                  labelStyle: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: isSelected ? Colors.white : AppColors.textPrimary,
                  ),
                  onSelected: (_) {
                    setState(() => _selectedSpecialty = value);
                    context.read<HealthProvider>().filterBySpecialty(
                          value.isEmpty ? null : value,
                        );
                  },
                );
              },
            ),
          ),
        ),
        const Divider(height: 1, color: AppColors.border),

        // Doctor list
        Expanded(
          child: Consumer<HealthProvider>(
            builder: (context, provider, _) {
              if (provider.isLoading && provider.doctors.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }
              if (provider.error != null && provider.doctors.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: AppColors.error),
                      const SizedBox(height: 16),
                      Text(provider.error!,
                          style:
                              const TextStyle(color: AppColors.textSecondary)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => provider.searchDoctors(),
                        child: const Text('Erneut versuchen'),
                      ),
                    ],
                  ),
                );
              }
              if (provider.doctors.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.person_search,
                          size: 64,
                          color: AppColors.textSecondary.withOpacity(0.3)),
                      const SizedBox(height: 16),
                      const Text('Keine Ärzte gefunden',
                          style: TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      const Text('Aktivieren Sie Standortzugriff',
                          style: TextStyle(color: AppColors.textSecondary)),
                    ],
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: () async => provider.searchDoctors(),
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: provider.doctors.length,
                  itemBuilder: (context, index) {
                    final doc = provider.doctors[index];
                    return _DoctorListCard(doctor: doc);
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildAiHealthHeader() {
    return Consumer<AiChatProvider>(
      builder: (context, ai, _) {
        return Container(
          margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
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
              InkWell(
                onTap: () => setState(() => _showAiChat = !_showAiChat),
                borderRadius: BorderRadius.circular(16),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.auto_awesome,
                            color: AppColors.primary, size: 18),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Health AI Assistent',
                                style: TextStyle(
                                    fontSize: 14, fontWeight: FontWeight.w600)),
                            Text('Symptome erfragen · Triage · Arzt-Empfehlung',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                      AnimatedRotation(
                        turns: _showAiChat ? 0.5 : 0,
                        duration: const Duration(milliseconds: 200),
                        child: const Icon(Icons.expand_more,
                            color: AppColors.textSecondary, size: 20),
                      ),
                    ],
                  ),
                ),
              ),
              if (_showAiChat) ...[
                const Divider(height: 1, color: AppColors.border),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (ai.messages.isNotEmpty) ...[
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 100),
                          child: ListView(
                            shrinkWrap: true,
                            children: ai.messages
                                .where((m) => m.role.name != 'system')
                                .toList()
                                .reversed
                                .take(2)
                                .toList()
                                .reversed
                                .map((msg) => Container(
                                      margin: const EdgeInsets.only(bottom: 6),
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: msg.role.name == 'user'
                                            ? AppColors.primary
                                                .withOpacity(0.08)
                                            : AppColors.card,
                                        borderRadius: BorderRadius.circular(10),
                                        border: msg.role.name != 'user'
                                            ? Border.all(
                                                color: AppColors.border)
                                            : null,
                                      ),
                                      child: Text(msg.content,
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              fontSize: 12, height: 1.3)),
                                    ))
                                .toList(),
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _aiChatController,
                              enabled: !ai.isLoading,
                              textInputAction: TextInputAction.send,
                              onSubmitted: ai.isLoading
                                  ? null
                                  : (v) => _sendAiChatMessage(v),
                              decoration: InputDecoration(
                                hintText: ai.isLoading
                                    ? 'Denkt nach...'
                                    : 'Frag nach Symptomen...',
                                hintStyle: TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textSecondary
                                        .withOpacity(0.6)),
                                filled: true,
                                fillColor: AppColors.surface,
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 10),
                                border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(20),
                                    borderSide: BorderSide.none),
                                isDense: true,
                              ),
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            decoration: BoxDecoration(
                              color: ai.isLoading
                                  ? AppColors.textSecondary.withOpacity(0.3)
                                  : AppColors.primary,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: IconButton(
                              icon: ai.isLoading
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2, color: Colors.white))
                                  : const Icon(Icons.send_rounded,
                                      color: Colors.white, size: 16),
                              onPressed: ai.isLoading
                                  ? null
                                  : () => _sendAiChatMessage(
                                      _aiChatController.text),
                              padding: const EdgeInsets.all(8),
                              constraints: const BoxConstraints(
                                  minWidth: 34, minHeight: 34),
                            ),
                          ),
                        ],
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

  Widget _buildAppointmentReminderBanner() {
    return Consumer<HealthProvider>(
      builder: (context, prov, _) {
        final appointments = prov.upcomingAppointments;
        if (appointments.isEmpty) return const SizedBox.shrink();
        final next = appointments.first;
        return Container(
          margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.info.withOpacity(0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.info.withOpacity(0.25)),
          ),
          child: Row(
            children: [
              const Icon(Icons.alarm_on, color: AppColors.info, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Termin ${next.countdownLabel}',
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w700)),
                    Text('${next.doctorName} · ${next.date} ${next.time} Uhr',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLebenszeichenStatus() {
    return Consumer<CheckinProvider>(
      builder: (context, checkin, _) {
        final isActive = checkin.isActive;
        return Container(
          margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color: isActive
                    ? AppColors.success.withOpacity(0.3)
                    : AppColors.border),
          ),
          child: Row(
            children: [
              Icon(Icons.verified_user_outlined,
                  size: 18,
                  color:
                      isActive ? AppColors.success : AppColors.textSecondary),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Lebenszeichen',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isActive
                                ? AppColors.success
                                : AppColors.textPrimary)),
                    Text(
                        isActive
                            ? 'Aktiv · Alle ${checkin.status?.currentIntervalHours ?? 24}h'
                            : 'Nicht aktiv',
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              Switch(
                value: isActive,
                onChanged: checkin.isLoading
                    ? null
                    : (val) async {
                        val
                            ? await checkin.activate()
                            : await checkin.deactivate();
                      },
                activeColor: AppColors.primary,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ],
          ),
        );
      },
    );
  }
}

// ============================================================================
// Doctor List Card
// ============================================================================

class _DoctorListCard extends StatelessWidget {
  final dynamic doctor;

  const _DoctorListCard({required this.doctor});

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
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary, AppColors.primaryLight],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child:
                const Icon(Icons.local_hospital, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(doctor.name ?? '',
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600)),
                Text(doctor.specialty ?? '',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.primary)),
                Text(doctor.address ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          if (doctor.distanceKm != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text('${doctor.distanceKm!.toStringAsFixed(1)} km',
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary)),
            ),
        ],
      ),
    );
  }
}
