import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'finance_provider.dart';

class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<FinanceProvider>();
      if (!provider.hasLoaded) {
        provider.loadWallet();
        provider.loadTransactions();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Finanzen'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: _showTransactionHistory,
          ),
        ],
      ),
      body: Consumer<FinanceProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && !provider.hasLoaded) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null && provider.wallet == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(provider.error!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      provider.loadWallet();
                      provider.loadTransactions();
                    },
                    child: const Text('Erneut versuchen'),
                  ),
                ],
              ),
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildBalanceCard(provider),
                const SizedBox(height: 24),
                _buildPaymentSection(provider),
                const SizedBox(height: 24),
                _buildRecentTransactions(provider),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildBalanceCard(FinanceProvider provider) {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Text(
              'Aktuelles Guthaben',
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            Text(
              '${provider.balance.toStringAsFixed(2)} €',
              style: const TextStyle(
                fontSize: 36,
                fontWeight: FontWeight.bold,
                color: Colors.green,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildQuickAction(
                  icon: Icons.send,
                  label: 'Senden',
                  onTap: _showSendDialog,
                ),
                _buildQuickAction(
                  icon: Icons.request_quote,
                  label: 'Anfordern',
                  onTap: _showRequestDialog,
                ),
                _buildQuickAction(
                  icon: Icons.qr_code_scanner,
                  label: 'Scan',
                  onTap: _showQrScanner,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickAction({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Column(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
            child: Icon(icon, color: Theme.of(context).colorScheme.primary),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildPaymentSection(FinanceProvider provider) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Zahlung starten',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              decoration: const InputDecoration(
                labelText: 'Empfänger',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.person),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(
                labelText: 'Betrag (€)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.euro),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(
                labelText: 'Nachricht (optional)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.message),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _sendPayment,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('Geld senden'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentTransactions(FinanceProvider provider) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Letzte Transaktionen',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                TextButton(
                  onPressed: _showTransactionHistory,
                  child: const Text('Alle anzeigen'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (provider.transactions.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('Noch keine Transaktionen'),
                ),
              )
            else
              ...provider.transactions.take(5).map(
                    (tx) => _buildTransactionTile(tx),
                  ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionTile(Transaction transaction) {
    final isPositive = transaction.amount > 0;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: isPositive ? Colors.green : Colors.red,
        child: Icon(
          isPositive ? Icons.arrow_downward : Icons.arrow_upward,
          color: Colors.white,
        ),
      ),
      title: Text(transaction.toWalletId),
      subtitle: Text(transaction.createdAt),
      trailing: Text(
        '${isPositive ? '+' : ''}${transaction.amount.toStringAsFixed(2)} €',
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: isPositive ? Colors.green : Colors.red,
        ),
      ),
    );
  }

  void _showSendDialog() {
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
              const Text(
                'Geld senden',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'Empfänger (Username oder Adresse)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'Betrag (€)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _sendPayment();
                  },
                  child: const Text('Senden'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showRequestDialog() {
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
              const Text(
                'Geld anfordern',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'Von (Username oder Adresse)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'Betrag (€)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Zahlungsanfrage gesendet')),
                    );
                  },
                  child: const Text('Anfordern'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showQrScanner() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('QR-Scanner wird geöffnet...')),
    );
  }

  void _sendPayment() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Zahlung wird gesendet...')),
    );
    // TODO: Formular-Werte auslesen und sendPayment() aufrufen
  }

  void _showTransactionHistory() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => Scaffold(
          appBar: AppBar(title: const Text('Transaktionshistorie')),
          body: Consumer<FinanceProvider>(
            builder: (context, provider, child) {
              if (provider.transactions.isEmpty) {
                return const Center(
                    child: Text('Keine Transaktionen vorhanden'));
              }
              return ListView.builder(
                itemCount: provider.transactions.length,
                itemBuilder: (context, index) {
                  return _buildTransactionTile(provider.transactions[index]);
                },
              );
            },
          ),
        ),
      ),
    );
  }
}
