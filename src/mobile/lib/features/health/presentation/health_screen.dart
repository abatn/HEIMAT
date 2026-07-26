import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/heimat_bottom_sheet.dart';
import '../../../core/widgets/empty_state.dart';
import 'health_provider.dart';

class HealthScreen extends StatefulWidget {
  const HealthScreen({super.key});

  @override
  State<HealthScreen> createState() => _HealthScreenState();
}

class _HealthScreenState extends State<HealthScreen> {
  String _selectedSpecialty = '';

  static const _specialties = [
    ('', 'Alle', Icons.local_hospital),
    ('Allgemeinmedizin', 'Allgemein', Icons.medical_services),
    ('Zahnarzt', 'Zahnarzt', Icons.medical_services),
    ('Augenarzt', 'Augenarzt', Icons.remove_red_eye),
    ('HNO-Arzt', 'HNO', Icons.hearing),
    ('Hautarzt', 'Hautarzt', Icons.face),
  ];

  IconData _specialtyIcon(String specialty) {
    for (final (val, _, icon) in _specialties) {
      if (val == specialty) return icon;
    }
    return Icons.person;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<HealthProvider>().searchDoctors();
    });
  }

  void _showRegisterSheet() {
    final nameController = TextEditingController();
    final specialtyController = TextEditingController();
    final addressController = TextEditingController();
    final phoneController = TextEditingController();
    final emailController = TextEditingController();

    showHeimatBottomSheet(
      context,
      title: 'Arzt eintragen',
      footer: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: () async {
            final name = nameController.text.trim();
            final specialty = specialtyController.text.trim();
            final address = addressController.text.trim();
            if (name.isEmpty || specialty.isEmpty || address.isEmpty) return;
            Navigator.pop(context);
            final ok = await context.read<HealthProvider>().registerDoctor(
                  name: name,
                  specialty: specialty,
                  address: address,
                  phone: phoneController.text.trim(),
                  email: emailController.text.trim(),
                );
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(ok
                      ? '$name registriert (Slots: Mo-Fr 8-12, 13-17).'
                      : 'Registrierung fehlgeschlagen'),
                  backgroundColor: ok ? AppColors.success : AppColors.error,
                ),
              );
              if (ok) {
                context.read<HealthProvider>().searchDoctors(
                      specialty: _selectedSpecialty.isEmpty
                          ? null
                          : _selectedSpecialty,
                    );
              }
            }
          },
          child: const Text('Registrieren'),
        ),
      ),
      child: Column(
        children: [
          _buildGradientField(
            controller: nameController,
            label: 'Praxisname *',
            icon: Icons.business_outlined,
          ),
          const SizedBox(height: 12),
          _buildGradientField(
            controller: specialtyController,
            label: 'Fachrichtung *',
            icon: Icons.medical_services_outlined,
          ),
          const SizedBox(height: 12),
          _buildGradientField(
            controller: addressController,
            label: 'Adresse *',
            icon: Icons.location_on_outlined,
          ),
          const SizedBox(height: 12),
          _buildGradientField(
            controller: phoneController,
            label: 'Telefon (optional)',
            icon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 12),
          _buildGradientField(
            controller: emailController,
            label: 'E-Mail (optional)',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withOpacity(0.08),
                  AppColors.primary.withOpacity(0.02),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primary.withOpacity(0.15)),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline,
                    size: 18, color: AppColors.primary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Standard-Slots: Mo-Fr 8:00-12:00, 13:00-17:00',
                    style:
                        TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGradientField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType? keyboardType,
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
          prefixIcon: Icon(icon),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        keyboardType: keyboardType,
      ),
    );
  }

  void _showBookingSheet(Doctor doctor) {
    if (doctor.source == 'osm') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'OSM-Ärzte: Bitte kontaktieren Sie die Praxis direkt. Terminbuchung ist nur für registrierte Ärzte verfügbar.'),
          duration: Duration(seconds: 4),
        ),
      );
      return;
    }

    final nameController = TextEditingController();
    final emailController = TextEditingController();
    final dateController = TextEditingController(
        text: DateTime.now().toIso8601String().substring(0, 10));
    String? selectedTime;

    showHeimatBottomSheet(
      context,
      title: 'Termin buchen',
      footer: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: selectedTime == null || nameController.text.isEmpty
              ? null
              : () async {
                  Navigator.pop(context);
                  final ok =
                      await context.read<HealthProvider>().bookAppointment(
                            doctor.id,
                            nameController.text.trim(),
                            emailController.text.trim(),
                            dateController.text,
                            selectedTime!,
                          );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(ok
                            ? 'Termin gebucht: ${dateController.text} $selectedTime'
                            : 'Buchung fehlgeschlagen'),
                        backgroundColor:
                            ok ? AppColors.success : AppColors.error,
                      ),
                    );
                  }
                },
          child: const Text('Termin buchen'),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Doctor header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withOpacity(0.1),
                  AppColors.primary.withOpacity(0.03),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.primary.withOpacity(0.15)),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, AppColors.primaryLight],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Icon(_specialtyIcon(doctor.specialty),
                      color: Colors.white, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(doctor.name,
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w600)),
                      Text(doctor.specialty,
                          style: const TextStyle(
                              fontSize: 13, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _buildGradientField(
            controller: nameController,
            label: 'Ihr Name',
            icon: Icons.person_outline,
          ),
          const SizedBox(height: 12),
          _buildGradientField(
            controller: emailController,
            label: 'E-Mail (optional)',
            icon: Icons.email_outlined,
          ),
          const SizedBox(height: 12),
          _buildGradientField(
            controller: dateController,
            label: 'Datum',
            icon: Icons.calendar_today,
          ),
          const SizedBox(height: 16),
          const Text('Verfügbare Zeiten',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          Consumer<HealthProvider>(
            builder: (_, prov, __) {
              if (prov.isLoading && prov.slots.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              if (prov.slots.isEmpty) {
                return Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text('Keine Termine verfügbar',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondary)),
                );
              }
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: prov.slots.where((s) => s.isAvailable).map((slot) {
                  final label = slot.endTime.isNotEmpty
                      ? '${slot.startTime}-${slot.endTime}'
                      : slot.startTime;
                  final isSelected = selectedTime == slot.startTime;
                  return ChoiceChip(
                    label: Text(label),
                    selected: isSelected,
                    selectedColor: AppColors.primary,
                    backgroundColor: AppColors.surface,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : AppColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                    side: BorderSide(
                      color: isSelected
                          ? AppColors.primary
                          : AppColors.border,
                    ),
                    onSelected: (_) {
                      setState(() => selectedTime = slot.startTime);
                    },
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
          onPressed: _showRegisterSheet,
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          icon: const Icon(Icons.add, size: 20),
          label: const Text('Arzt eintragen',
              style: TextStyle(fontWeight: FontWeight.w600)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      body: Column(
        children: [
          // Filter chips row
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: SizedBox(
              height: 42,
              child: ListView.separated(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: _specialties.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final (value, label, icon) = _specialties[index];
                  final isSelected = _selectedSpecialty == value;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    child: FilterChip(
                      label: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(icon, size: 16,
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
                        color: isSelected
                            ? AppColors.primary
                            : AppColors.border,
                        width: isSelected ? 0 : 1,
                      ),
                      labelStyle: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: isSelected
                            ? Colors.white
                            : AppColors.textPrimary,
                      ),
                      onSelected: (_) {
                        setState(() => _selectedSpecialty = value);
                        context.read<HealthProvider>().searchDoctors(
                              specialty: value.isEmpty ? null : value,
                            );
                      },
                    ),
                  );
                },
              ),
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          // Doctor list
          Expanded(
            child: Consumer<HealthProvider>(
              builder: (context, provider, child) {
                if (provider.isLoading && provider.doctors.isEmpty) {
                  return _HealthSkeleton();
                }
                if (provider.error != null && provider.doctors.isEmpty) {
                  return Center(
                    child: EmptyState(
                      icon: Icons.error_outline,
                      title: 'Fehler',
                      description: provider.error!,
                      action: ElevatedButton(
                        onPressed: () =>
                            context.read<HealthProvider>().searchDoctors(
                                  specialty: _selectedSpecialty.isEmpty
                                      ? null
                                      : _selectedSpecialty,
                                ),
                        child: const Text('Erneut versuchen'),
                      ),
                    ),
                  );
                }
                if (provider.doctors.isEmpty) {
                  return const EmptyState(
                    icon: Icons.person_search,
                    title: 'Keine Ärzte gefunden',
                    description: 'Versuche eine andere Fachrichtung.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async {
                    await context.read<HealthProvider>().searchDoctors(
                          specialty: _selectedSpecialty.isEmpty
                              ? null
                              : _selectedSpecialty,
                        );
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: provider.doctors.length,
                    itemBuilder: (context, index) {
                      final doc = provider.doctors[index];
                      return _DoctorCard(
                        doctor: doc,
                        specialtyIcon: _specialtyIcon(doc.specialty),
                        onBook: () => _showBookingSheet(doc),
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
}

// ============================================================================
// Doctor Card — animiert, mit Gradient & Presseffekt
// ============================================================================

class _DoctorCard extends StatefulWidget {
  final Doctor doctor;
  final IconData specialtyIcon;
  final VoidCallback onBook;

  const _DoctorCard({
    required this.doctor,
    required this.specialtyIcon,
    required this.onBook,
  });

  @override
  State<_DoctorCard> createState() => _DoctorCardState();
}

class _DoctorCardState extends State<_DoctorCard> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final doc = widget.doctor;
    final isOsm = doc.source == 'osm';

    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
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
          child: Row(
            children: [
              // Doctor icon with gradient
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: isOsm
                        ? [AppColors.secondary, AppColors.secondaryLight]
                        : [AppColors.primary, AppColors.primaryLight],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: (isOsm ? AppColors.secondary : AppColors.primary)
                          .withOpacity(0.25),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Icon(
                  widget.specialtyIcon,
                  color: Colors.white,
                  size: 24,
                ),
              ),
              const SizedBox(width: 14),
              // Details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(doc.name,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              )),
                        ),
                        if (isOsm)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  AppColors.secondary.withOpacity(0.15),
                                  AppColors.secondary.withOpacity(0.05),
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                  color:
                                      AppColors.secondary.withOpacity(0.2)),
                            ),
                            child: const Text(
                              'OSM',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: AppColors.secondary,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(doc.specialty,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.primary,
                          fontWeight: FontWeight.w500,
                        )),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        const Icon(Icons.location_on_outlined,
                            size: 12, color: AppColors.textSecondary),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(doc.address,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              )),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              isOsm
                  ? Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.secondary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.phone_outlined,
                          size: 20, color: AppColors.secondary),
                    )
                  : ElevatedButton(
                      onPressed: widget.onBook,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        elevation: 0,
                      ),
                      child: const Text('Termin',
                          style: TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// Skeleton Loading — Shimmer für HealthScreen
// ============================================================================

class _HealthSkeleton extends StatefulWidget {
  @override
  State<_HealthSkeleton> createState() => _HealthSkeletonState();
}

class _HealthSkeletonState extends State<_HealthSkeleton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
    _animation = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOutSine),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, _) {
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
              child: Row(
                children: [
                  _shimmerBox(width: 52, height: 52, borderRadius: 26),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _shimmerBox(height: 14, width: 160),
                        const SizedBox(height: 8),
                        _shimmerBox(height: 11, width: 100),
                        const SizedBox(height: 6),
                        _shimmerBox(height: 11, width: 140),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _shimmerBox(width: 60, height: 32, borderRadius: 10),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _shimmerBox({
    double width = double.infinity,
    double height = 14,
    double borderRadius = 8,
  }) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        gradient: LinearGradient(
          colors: [
            Colors.grey.shade200,
            Colors.grey.shade100,
            Colors.grey.shade200,
          ],
          stops: [
            0.0,
            _animation.value.clamp(0.3, 0.7),
            1.0,
          ],
        ),
      ),
    );
  }
}
