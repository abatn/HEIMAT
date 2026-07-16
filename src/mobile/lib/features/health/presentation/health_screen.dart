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
          TextField(
            controller: nameController,
            decoration: const InputDecoration(
              labelText: 'Praxisname *',
              prefixIcon: Icon(Icons.business_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: specialtyController,
            decoration: const InputDecoration(
              labelText: 'Fachrichtung *',
              prefixIcon: Icon(Icons.medical_services_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: addressController,
            decoration: const InputDecoration(
              labelText: 'Adresse *',
              prefixIcon: Icon(Icons.location_on_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: phoneController,
            decoration: const InputDecoration(
              labelText: 'Telefon (optional)',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: emailController,
            decoration: const InputDecoration(
              labelText: 'E-Mail (optional)',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline,
                    size: 18, color: AppColors.textSecondary),
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
          // ignore: unnecessary_null_comparison
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
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(_specialtyIcon(doctor.specialty),
                    color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 12),
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
          const SizedBox(height: 20),
          TextField(
            controller: nameController,
            decoration: const InputDecoration(
              labelText: 'Ihr Name',
              prefixIcon: Icon(Icons.person_outline),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: emailController,
            decoration: const InputDecoration(
              labelText: 'E-Mail (optional)',
              prefixIcon: Icon(Icons.email_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: dateController,
            decoration: const InputDecoration(
              labelText: 'Datum',
              prefixIcon: Icon(Icons.calendar_today),
            ),
            onChanged: (_) {
              context
                  .read<HealthProvider>()
                  .loadSlots(doctor.id, dateController.text);
            },
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
                  padding: EdgeInsets.all(8),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              if (prov.slots.isEmpty) {
                return const Text('Keine Termine verfügbar',
                    style: TextStyle(color: AppColors.textSecondary));
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
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : AppColors.textPrimary,
                      fontWeight: FontWeight.w500,
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showRegisterSheet,
        icon: const Icon(Icons.add),
        label: const Text('Arzt eintragen'),
      ),
      body: Column(
        children: [
          SizedBox(
            height: 56,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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
                      Icon(icon, size: 16),
                      const SizedBox(width: 4),
                      Text(label),
                    ],
                  ),
                  selected: isSelected,
                  selectedColor: AppColors.primary,
                  checkmarkColor: Colors.white,
                  labelStyle: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: isSelected ? Colors.white : AppColors.textPrimary,
                  ),
                  onSelected: (_) {
                    setState(() => _selectedSpecialty = value);
                    context.read<HealthProvider>().searchDoctors(
                          specialty: value.isEmpty ? null : value,
                        );
                  },
                );
              },
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: Consumer<HealthProvider>(
              builder: (context, provider, child) {
                if (provider.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (provider.error != null) {
                  return Center(
                    child: EmptyState(
                      icon: Icons.error_outline,
                      title: 'Fehler',
                      description: provider.error!,
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
                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: provider.doctors.length,
                  itemBuilder: (context, index) {
                    final doc = provider.doctors[index];
                    return _buildDoctorCard(doc);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDoctorCard(Doctor doc) {
    final isOsm = doc.source == 'osm';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: isOsm
                    ? AppColors.secondary.withOpacity(0.1)
                    : AppColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _specialtyIcon(doc.specialty),
                color: isOsm ? AppColors.secondary : AppColors.primary,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
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
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.secondary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
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
                  const SizedBox(height: 2),
                  Text(doc.specialty,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.primary,
                      )),
                  const SizedBox(height: 2),
                  Text(doc.address,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      )),
                ],
              ),
            ),
            const SizedBox(width: 8),
            isOsm
                ? const Icon(Icons.phone_outlined,
                    size: 20, color: AppColors.textSecondary)
                : ElevatedButton(
                    onPressed: () => _showBookingSheet(doc),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                    ),
                    child: const Text('Termin', style: TextStyle(fontSize: 13)),
                  ),
          ],
        ),
      ),
    );
  }
}
