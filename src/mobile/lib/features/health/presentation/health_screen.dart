import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'health_provider.dart';

class HealthScreen extends StatefulWidget {
  const HealthScreen({super.key});

  @override
  State<HealthScreen> createState() => _HealthScreenState();
}

class _HealthScreenState extends State<HealthScreen> {
  String _selectedSpecialty = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<HealthProvider>().searchDoctors();
    });
  }

  void _showBookingDialog(Doctor doctor) {
    final nameController = TextEditingController();
    final emailController = TextEditingController();
    final dateController = TextEditingController(
        text: DateTime.now().toIso8601String().substring(0, 10));
    String? selectedTime;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Termin bei ${doctor.name}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(doctor.specialty,
                    style: const TextStyle(color: Colors.grey)),
                const SizedBox(height: 12),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Ihr Name',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: emailController,
                  decoration: const InputDecoration(
                    labelText: 'E-Mail (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: dateController,
                  decoration: const InputDecoration(
                    labelText: 'Datum (YYYY-MM-DD)',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (_) {
                    context
                        .read<HealthProvider>()
                        .loadSlots(doctor.id, dateController.text);
                  },
                ),
                const SizedBox(height: 12),
                Consumer<HealthProvider>(
                  builder: (_, prov, __) {
                    if (prov.isLoading && prov.slots.isEmpty) {
                      return const CircularProgressIndicator();
                    }
                    if (prov.slots.isEmpty) {
                      return const Text('Keine Termine verfügbar');
                    }
                    return Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children:
                          prov.slots.where((s) => s.isAvailable).map((slot) {
                        final label = slot.endTime.isNotEmpty
                            ? '${slot.startTime}-${slot.endTime}'
                            : slot.startTime;
                        return ChoiceChip(
                          label: Text(label),
                          selected: selectedTime == slot.startTime,
                          onSelected: (_) {
                            setDialogState(() {
                              selectedTime = slot.startTime;
                            });
                          },
                        );
                      }).toList(),
                    );
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Abbrechen'),
            ),
            ElevatedButton(
              onPressed: selectedTime == null || nameController.text.isEmpty
                  ? null
                  : () async {
                      Navigator.pop(ctx);
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
                            backgroundColor: ok ? Colors.green : Colors.red,
                          ),
                        );
                      }
                    },
              child: const Text('Buchen'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gesundheit')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: DropdownButtonFormField<String>(
              value: _selectedSpecialty.isEmpty ? null : _selectedSpecialty,
              decoration: const InputDecoration(
                labelText: 'Fachrichtung',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: '', child: Text('Alle')),
                DropdownMenuItem(
                    value: 'Allgemeinmedizin', child: Text('Allgemeinmedizin')),
                DropdownMenuItem(value: 'Zahnarzt', child: Text('Zahnarzt')),
                DropdownMenuItem(value: 'Augenarzt', child: Text('Augenarzt')),
                DropdownMenuItem(value: 'HNO-Arzt', child: Text('HNO-Arzt')),
                DropdownMenuItem(value: 'Hautarzt', child: Text('Hautarzt')),
              ],
              onChanged: (v) {
                setState(() => _selectedSpecialty = v ?? '');
                context.read<HealthProvider>().searchDoctors(
                      specialty: v?.isEmpty ?? true ? null : v,
                    );
              },
            ),
          ),
          Expanded(
            child: Consumer<HealthProvider>(
              builder: (context, provider, child) {
                if (provider.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (provider.error != null) {
                  return Center(child: Text(provider.error!));
                }
                if (provider.doctors.isEmpty) {
                  return const Center(child: Text('Keine Ärzte gefunden'));
                }
                return ListView.builder(
                  itemCount: provider.doctors.length,
                  itemBuilder: (context, index) {
                    final doc = provider.doctors[index];
                    return Card(
                      margin: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 4),
                      child: ListTile(
                        title: Text(doc.name),
                        subtitle: Text('${doc.specialty}\n${doc.address}'),
                        isThreeLine: true,
                        trailing: ElevatedButton(
                          onPressed: () => _showBookingDialog(doc),
                          child: const Text('Termin'),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
