import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../auth/presentation/auth_provider.dart';

/// ProfileScreen — Profil-Tab (WeChat "Me" Pattern)
///
/// Features:
/// - User-Avatar (Initials)
/// - Name + E-Mail
/// - Einstellungen
/// - Verlauf
/// - Notfall-Kontakt
/// - Abmelden
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        final userEmail = auth.email ?? '';
        final userName =
            userEmail.isNotEmpty ? userEmail.split('@').first : 'Benutzer';
        final initials =
            userName.isNotEmpty ? userName.substring(0, 1).toUpperCase() : '?';

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            // User Header
            _buildUserHeader(initials, userName, userEmail),
            const SizedBox(height: 24),

            // Einstellungen
            _buildSettingsSection(context),
            const SizedBox(height: 16),

            // Verlauf
            _buildHistorySection(context),
            const SizedBox(height: 16),

            // Notfall
            _buildEmergencySection(context),
            const SizedBox(height: 24),

            // Abmelden
            _buildLogoutButton(context, auth),
          ],
        );
      },
    );
  }

  // ------------------------------------------------------------------
  // User Header
  // ------------------------------------------------------------------

  Widget _buildUserHeader(String initials, String name, String email) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                initials,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          // Name + Email
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                if (email.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    email,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white.withOpacity(0.8),
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Bearbeiten
          IconButton(
            icon: const Icon(Icons.edit_outlined, color: Colors.white70),
            onPressed: () {
              // TODO: Profil bearbeiten
            },
          ),
        ],
      ),
    );
  }

  // ------------------------------------------------------------------
  // Einstellungen
  // ------------------------------------------------------------------

  Widget _buildSettingsSection(BuildContext context) {
    return _buildSection(
      title: '⚙️ Einstellungen',
      children: [
        _buildSettingsTile(
          icon: Icons.notifications_outlined,
          title: 'Benachrichtigungen',
          subtitle: 'Smart Alerts konfigurieren',
          onTap: () {},
        ),
        _buildSettingsTile(
          icon: Icons.language_outlined,
          title: 'Sprache',
          subtitle: 'Deutsch',
          onTap: () {},
        ),
        _buildSettingsTile(
          icon: Icons.shield_outlined,
          title: 'Datenschutz',
          subtitle: 'DSGVO-Einstellungen',
          onTap: () {},
        ),
        _buildSettingsTile(
          icon: Icons.color_lens_outlined,
          title: 'Erscheinungsbild',
          subtitle: 'Automatisch (System-Thema)',
          onTap: () {},
        ),
      ],
    );
  }

  // ------------------------------------------------------------------
  // Verlauf
  // ------------------------------------------------------------------

  Widget _buildHistorySection(BuildContext context) {
    return _buildSection(
      title: '📋 Verlauf',
      children: [
        _buildSettingsTile(
          icon: Icons.history,
          title: 'Letzte Aktivitäten',
          subtitle: 'Zuletzt besuchte Dienste',
          onTap: () {},
        ),
        _buildSettingsTile(
          icon: Icons.favorite_outline,
          title: 'Favoriten',
          subtitle: 'Gespeicherte Dienste',
          onTap: () {},
        ),
      ],
    );
  }

  // ------------------------------------------------------------------
  // Notfall
  // ------------------------------------------------------------------

  Widget _buildEmergencySection(BuildContext context) {
    return _buildSection(
      title: '🚨 Notfall',
      children: [
        _buildEmergencyTile(
          icon: Icons.emergency,
          iconColor: Colors.red,
          title: 'Notruf',
          subtitle: '112',
          onTap: () {},
        ),
        _buildEmergencyTile(
          icon: Icons.medical_services_outlined,
          iconColor: Colors.orange,
          title: 'Ärztefunktion',
          subtitle: '116117',
          onTap: () {},
        ),
      ],
    );
  }

  // ------------------------------------------------------------------
  // Abmelden
  // ------------------------------------------------------------------

  Widget _buildLogoutButton(BuildContext context, AuthProvider auth) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () async {
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Abmelden'),
              content: const Text('Möchtest du dich wirklich abmelden?'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Abbrechen'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Abmelden',
                      style: TextStyle(color: Colors.red)),
                ),
              ],
            ),
          );
          if (confirmed == true) {
            await auth.logout();
          }
        },
        icon: const Icon(Icons.logout, color: Colors.red),
        label: const Text('Abmelden', style: TextStyle(color: Colors.red)),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Colors.red),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  Widget _buildSection({
    required String title,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, size: 22, color: AppColors.textSecondary),
      title: Text(
        title,
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
      ),
      trailing: const Icon(Icons.chevron_right,
          size: 20, color: AppColors.textSecondary),
      onTap: onTap,
    );
  }

  Widget _buildEmergencyTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, size: 22, color: iconColor),
      title: Text(
        title,
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      ),
      subtitle: Text(
        subtitle,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: iconColor,
        ),
      ),
      trailing: const Icon(Icons.chevron_right,
          size: 20, color: AppColors.textSecondary),
      onTap: onTap,
    );
  }
}
