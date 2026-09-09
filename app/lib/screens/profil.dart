import 'package:flutter/material.dart';
import '../api/api.dart';
import '../theme/tokens.dart';

class ProfilScreen extends StatelessWidget {
  final VoidCallback onLogout;
  const ProfilScreen({super.key, required this.onLogout});

  String _goalLabel(String? goal) {
    const map = {
      'weight_loss': 'Turun berat badan',
      'muscle_gain': 'Naik mass otot',
      'maintenance': 'Maintenance',
    };
    return map[goal] ?? 'Makan sehat';
  }

  @override
  Widget build(BuildContext context) {
    final u = api.user ?? {};
    final name = u['full_name'] as String? ?? 'Koki';
    final email = u['email'] as String? ?? '';
    final isPro = u['tier'] == 'premium';

    return ListView(
      padding: const EdgeInsets.all(SajiSpace.s4),
      children: [
        // User card
        Container(
          padding: const EdgeInsets.all(SajiSpace.s5),
          decoration: BoxDecoration(
            color: SajiColors.surface,
            borderRadius: SajiRadius.cardA,
            border: Border.all(color: SajiColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 56, height: 56,
                decoration: const BoxDecoration(
                  gradient: SajiGradient.streakHero,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(name.isNotEmpty ? name[0].toUpperCase() : 'K',
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
              const SizedBox(width: SajiSpace.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(child: Text(name, style: SajiText.h3, overflow: TextOverflow.ellipsis)),
                        if (isPro) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(colors: [SajiColors.accent, SajiColors.amber400]),
                              borderRadius: BorderRadius.circular(SajiRadius.pill),
                            ),
                            child: const Text('Pro',
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: SajiColors.brown900)),
                          ),
                        ],
                      ],
                    ),
                    Text(email, style: SajiText.bodySm, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SajiSpace.s4),

        // Goal card
        Container(
          padding: const EdgeInsets.all(SajiSpace.s4),
          decoration: BoxDecoration(
            color: SajiColors.surface,
            borderRadius: SajiRadius.cardB,
            border: Border.all(color: SajiColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_goalLabel(u['goal'] as String?), style: SajiText.h3),
              const SizedBox(height: SajiSpace.s2),
              Row(
                children: [
                  _pill('${u['target_calories'] ?? '—'} kal', SajiColors.primary),
                  const SizedBox(width: 8),
                  _pill('${u['target_protein'] ?? '—'}g protein', SajiColors.accent),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: SajiSpace.s4),

        // Settings rows
        _SettingsTile(
          emoji: '👶', title: 'Mode Ramah Anak',
          subtitle: u['kid_friendly'] == true ? 'Aktif' : 'Nonaktif',
        ),
        _SettingsTile(
          emoji: '⚡', title: 'Meal 30 Menit',
          subtitle: u['quick_meals'] == true ? 'Aktif' : 'Nonaktif',
        ),
        _SettingsTile(
          emoji: '💰', title: 'Budget Mingguan',
          subtitle: u['budget_weekly'] != null ? 'Rp${u['budget_weekly']}' : 'Belum diset',
        ),
        _SettingsTile(
          emoji: '📱', title: 'Telegram',
          subtitle: u['telegram_chat_id'] != null ? 'Terhubung ✓' : 'Belum terhubung',
          subtitleColor: u['telegram_chat_id'] != null ? SajiColors.primary : null,
        ),
        _SettingsTile(
          emoji: '⭐', title: 'Saji Pro',
          subtitle: isPro ? 'Aktif' : 'Upgrade — Rp29rb/bulan',
          subtitleColor: SajiColors.accent,
        ),
        const SizedBox(height: SajiSpace.s5),

        OutlinedButton.icon(
          onPressed: () async {
            await api.logout();
            onLogout();
          },
          icon: const Icon(Icons.logout, color: SajiColors.danger, size: 18),
          label: const Text('Logout', style: TextStyle(color: SajiColors.danger)),
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: SajiColors.danger),
          ),
        ),
        const SizedBox(height: 80),
      ],
    );
  }

  Widget _pill(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(SajiRadius.pill),
      ),
      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color, fontFamily: 'JetBrains Mono')),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  final Color? subtitleColor;
  const _SettingsTile({required this.emoji, required this.title, required this.subtitle, this.subtitleColor});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: SajiSpace.s2),
      decoration: BoxDecoration(
        color: SajiColors.surface,
        borderRadius: BorderRadius.circular(SajiRadius.lg),
        border: Border.all(color: SajiColors.border),
      ),
      child: ListTile(
        leading: Text(emoji, style: const TextStyle(fontSize: 20)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text(subtitle, style: TextStyle(fontSize: 12, color: subtitleColor ?? SajiColors.textSubtle)),
        trailing: const Icon(Icons.chevron_right, color: SajiColors.textFaint),
        dense: true,
      ),
    );
  }
}
