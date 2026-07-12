import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'health_provider.dart';

class HealthScreen extends StatelessWidget {
  const HealthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gesundheit')),
      body: Consumer<HealthProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading)
            return const Center(child: CircularProgressIndicator());
          if (provider.error != null)
            return Center(child: Text(provider.error!));
          if (provider.doctors.isEmpty)
            return const Center(child: Text('Keine \u00c4rzte gefunden'));
          return ListView.builder(
            itemCount: provider.doctors.length,
            itemBuilder: (context, index) {
              final doc = provider.doctors[index];
              return Card(
                margin: const EdgeInsets.all(8),
                child: ListTile(
                  title: Text(doc.name),
                  subtitle: Text('${doc.specialty}\n${doc.address}'),
                  isThreeLine: true,
                  trailing: const Icon(Icons.chevron_right),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
