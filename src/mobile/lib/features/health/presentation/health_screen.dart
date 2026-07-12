import 'package:flutter/material.dart';

class HealthScreen extends StatefulWidget {
  const HealthScreen({super.key});

  @override
  State<HealthScreen> createState() => _HealthScreenState();
}

class _HealthScreenState extends State<HealthScreen> {
  final List<Map<String, dynamic>> _doctors = [
    {
      'id': 'doc1',
      'name': 'Dr. Anna Schmidt',
      'specialty': 'Allgemeinmedizin',
      'address': 'Hauptstraße 10, 10115 Berlin',
      'rating': 4.8,
      'available': true,
    },
    {
      'id': 'doc2',
      'name': 'Dr. Markus Weber',
      'specialty': 'Zahnarzt',
      'address': 'Berlinstraße 20, 10178 Berlin',
      'rating': 4.6,
      'available': true,
    },
    {
      'id': 'doc3',
      'name': 'Dr. Lisa Müller',
      'specialty': 'Augenarzt',
      'address': 'Auguststraße 5, 10117 Berlin',
      'rating': 4.9,
      'available': false,
    },
  ];

  final List<Map<String, dynamic>> _appointments = [
    {
      'doctor': 'Dr. Anna Schmidt',
      'specialty': 'Allgemeinmedizin',
      'date': '2024-02-15',
      'time': '10:00',
      'status': 'confirmed',
    },
  ];

  String _searchQuery = '';

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
          // Suchfeld
          _buildSearchBar(),
          // Tabs
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
      color: Theme.of(context).colorScheme.surfaceVariant,
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
          setState(() {
            _searchQuery = value;
          });
        },
      ),
    );
  }

  Widget _buildDoctorList() {
    final filteredDoctors = _doctors.where((doc) {
      if (_searchQuery.isEmpty) return true;
      return doc['name'].toLowerCase().contains(_searchQuery.toLowerCase()) ||
          doc['specialty'].toLowerCase().contains(_searchQuery.toLowerCase()) ||
          doc['address'].toLowerCase().contains(_searchQuery.toLowerCase());
    }).toList();

    if (filteredDoctors.isEmpty) {
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
      itemCount: filteredDoctors.length,
      itemBuilder: (context, index) {
        return _buildDoctorCard(filteredDoctors[index]);
      },
    );
  }

  Widget _buildDoctorCard(Map<String, dynamic> doctor) {
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
                        doctor['name'],
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        doctor['specialty'],
                        style: const TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: doctor['available'] ? Colors.green : Colors.red,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    doctor['available'] ? 'Verfügbar' : 'Nicht verfügbar',
                    style: const TextStyle(color: Colors.white, fontSize: 12),
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
                    doctor['address'],
                    style: const TextStyle(color: Colors.grey),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.star, size: 16, color: Colors.amber),
                const SizedBox(width: 4),
                Text('${doctor['rating']}'),
              ],
            ),
            const SizedBox(height: 12),
            if (doctor['available'])
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
    if (_appointments.isEmpty) {
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
      itemCount: _appointments.length,
      itemBuilder: (context, index) {
        return _buildAppointmentCard(_appointments[index]);
      },
    );
  }

  Widget _buildAppointmentCard(Map<String, dynamic> appointment) {
    final isConfirmed = appointment['status'] == 'confirmed';

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isConfirmed ? Colors.green : Colors.orange,
          child: Icon(
            isConfirmed ? Icons.check : Icons.pending,
            color: Colors.white,
          ),
        ),
        title: Text(appointment['doctor']),
        subtitle: Text(
            '${appointment['specialty']}\n${appointment['date']} um ${appointment['time']}'),
        trailing: PopupMenuButton(
          itemBuilder: (context) => [
            const PopupMenuItem(
              value: 'cancel',
              child: Text('Absagen'),
            ),
            if (!isConfirmed)
              const PopupMenuItem(
                value: 'confirm',
                child: Text('Bestätigen'),
              ),
          ],
          onSelected: (value) {
            _handleAppointmentAction(appointment, value);
          },
        ),
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
        builder: (context, scrollController) => Container(
          padding: const EdgeInsets.all(16),
          child: ListView(
            controller: scrollController,
            children: [
              const Text(
                'Meine Termine',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              ..._appointments.map((apt) => _buildAppointmentCard(apt)),
            ],
          ),
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
                    setState(() => _searchQuery = 'Allgemeinmedizin');
                    Navigator.pop(context);
                  },
                ),
                FilterChip(
                  label: const Text('Zahnarzt'),
                  onSelected: (selected) {
                    setState(() => _searchQuery = 'Zahnarzt');
                    Navigator.pop(context);
                  },
                ),
                FilterChip(
                  label: const Text('Augenarzt'),
                  onSelected: (selected) {
                    setState(() => _searchQuery = 'Augenarzt');
                    Navigator.pop(context);
                  },
                ),
                FilterChip(
                  label: const Text('Verfügbar'),
                  onSelected: (selected) {
                    setState(() => _searchQuery = '');
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

  void _bookAppointment(Map<String, dynamic> doctor) {
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
                'Termin bei ${doctor['name']}',
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
                  labelText: 'Datum (TT.MM.JJJJ)',
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
                    _confirmBooking(doctor);
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

  void _confirmBooking(Map<String, dynamic> doctor) {
    setState(() {
      _appointments.add({
        'doctor': doctor['name'],
        'specialty': doctor['specialty'],
        'date': '2024-02-20',
        'time': '09:00',
        'status': 'pending',
      });
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Terminanfrage an ${doctor['name']} gesendet'),
        action: SnackBarAction(
          label: 'OK',
          onPressed: () {},
        ),
      ),
    );
  }

  void _handleAppointmentAction(
      Map<String, dynamic> appointment, String action) {
    setState(() {
      if (action == 'cancel') {
        appointment['status'] = 'cancelled';
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Termin abgesagt')),
        );
      } else if (action == 'confirm') {
        appointment['status'] = 'confirmed';
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Termin bestätigt')),
        );
      }
    });
  }
}
