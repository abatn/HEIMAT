import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'health_provider.dart';

class HealthScreen extends StatefulWidget {
  const HealthScreen({super.key});

  @override
  State<HealthScreen> createState() => _HealthScreenState();
}

class _HealthScreenState extends State<HealthScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<HealthProvider>().searchDoctors();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Gesundheit'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today),
            onPressed: _showMyAppointments,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildSearchBar(),
          Expanded(
            child: DefaultTabController(
              length: 2,
              child: Column(
                children: [
                  const TabBar(
                    tabs: [
                      Tab(text: 'Ärzte suchen'),
                      Tab(text: 'Meine Termine'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(
                      children: [
                        _buildDoctorList(),
                        _buildAppointmentsList(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: TextField(
        decoration: InputDecoration(
          labelText: 'Arzt suchen (Fachrichtung oder Ort)',
          prefixIcon: const Icon(Icons.search),
          border: const OutlineInputBorder(),
          suffixIcon: IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterDialog,
          ),
        ),
        onChanged: (value) {
          context.read<HealthProvider>().searchDoctors(specialty: value);
        },
      ),
    );
  }

  Widget _buildDoctorList() {
    return Consumer<HealthProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 16),
                Text(provider.error!),
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
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.search_off, size: 64, color: Colors.grey),
                SizedBox(height: 16),
                Text('Keine Ärzte gefunden', style: TextStyle(fontSize: 18)),
              ],
            ),
          );
        }

        return ListView.builder(
          itemCount: provider.doctors.length,
          itemBuilder: (context, index) {
            return _buildDoctorCard(provider.doctors[index]);
          },
        );
      },
    );
  }

  Widget _buildDoctorCard(Doctor doctor) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        doctor.name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        doctor.specialty,
                        style: const TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.location_on, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    doctor.address,
                    style: const TextStyle(color: Colors.grey),
                  ),
                ),
              ],
            ),
            if (doctor.phone.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.phone, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(doctor.phone,
                      style: const TextStyle(color: Colors.grey)),
                ],
              ),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _bookAppointment(doctor),
                child: const Text('Termin buchen'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppointmentsList() {
    return Consumer<HealthProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.appointments.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.calendar_today, size: 64, color: Colors.grey),
                SizedBox(height: 16),
                Text('Keine Termine vorhanden', style: TextStyle(fontSize: 18)),
              ],
            ),
          );
        }

        return ListView.builder(
          itemCount: provider.appointments.length,
          itemBuilder: (context, index) {
            return _buildAppointmentCard(provider.appointments[index]);
          },
        );
      },
    );
  }

  Widget _buildAppointmentCard(Appointment appointment) {
    final isConfirmed = appointment.status == 'confirmed';

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isConfirmed
              ? Colors.green
              : appointment.status == 'cancelled'
                  ? Colors.red
                  : Colors.orange,
          child: Icon(
            isConfirmed
                ? Icons.check
                : appointment.status == 'cancelled'
                    ? Icons.close
                    : Icons.pending,
            color: Colors.white,
          ),
        ),
        title: Text('Termin ${appointment.id.substring(0, 8)}'),
        subtitle: Text(
          '${appointment.appointmentDate} um ${appointment.appointmentTime}\nStatus: ${appointment.status}',
        ),
        trailing: appointment.status != 'cancelled'
            ? PopupMenuButton(
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'cancel',
                    child: Text('Absagen'),
                  ),
                ],
                onSelected: (value) {
                  if (value == 'cancel') {
                    context
                        .read<HealthProvider>()
                        .cancelAppointment(appointment.id);
                  }
                },
              )
            : null,
      ),
    );
  }

  void _showMyAppointments() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) => Consumer<HealthProvider>(
          builder: (context, provider, child) {
            return Container(
              padding: const EdgeInsets.all(16),
              child: ListView(
                controller: scrollController,
                children: [
                  const Text(
                    'Meine Termine',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  if (provider.appointments.isEmpty)
                    const Center(child: Text('Keine Termine vorhanden'))
                  else
                    ...provider.appointments
                        .map((apt) => _buildAppointmentCard(apt)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  void _showFilterDialog() {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Filter',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: const Text('Allgemeinmedizin'),
                  onSelected: (selected) {
                    context
                        .read<HealthProvider>()
                        .searchDoctors(specialty: 'Allgemeinmedizin');
                    Navigator.pop(context);
                  },
                ),
                FilterChip(
                  label: const Text('Zahnarzt'),
                  onSelected: (selected) {
                    context
                        .read<HealthProvider>()
                        .searchDoctors(specialty: 'Zahnarzt');
                    Navigator.pop(context);
                  },
                ),
                FilterChip(
                  label: const Text('Augenarzt'),
                  onSelected: (selected) {
                    context
                        .read<HealthProvider>()
                        .searchDoctors(specialty: 'Augenarzt');
                    Navigator.pop(context);
                  },
                ),
                FilterChip(
                  label: const Text('Alle'),
                  onSelected: (selected) {
                    context.read<HealthProvider>().searchDoctors();
                    Navigator.pop(context);
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _bookAppointment(Doctor doctor) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Termin bei ${doctor.name}',
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'Ihr Name',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'E-Mail',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'Datum (JJJJ-MM-TT)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'Uhrzeit (HH:MM)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content:
                            Text('Terminanfrage an ${doctor.name} gesendet'),
                      ),
                    );
                  },
                  child: const Text('Termin anfragen'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
