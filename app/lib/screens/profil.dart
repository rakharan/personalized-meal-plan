import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api/api.dart';
import '../theme/tokens.dart';
import '../widgets/error.dart';

class ProfilScreen extends StatefulWidget {
  final VoidCallback onLogout;
  const ProfilScreen({super.key, required this.onLogout});

  @override
  State<ProfilScreen> createState() => _ProfilScreenState();
}

class _ProfilScreenState extends State<ProfilScreen> {
  bool _busy = false;

  String _goalLabel(String? goal) {
    const map = {
      'weight_loss': 'Turun berat badan',
      'muscle_gain': 'Naik mass otot',
      'maintenance': 'Maintenance',
    };
    return map[goal] ?? 'Makan sehat';
  }

  Future<void> _save(Map<String, dynamic> updates) async {
    if (_busy) return;
    setState(() { _busy = true; });
    try {
      await api.updateProfile(updates);
      setState(() {}); // api.user replaced — rebuild from fresh data
    } catch (e) {
      if (mounted) showSajiError(context, e);
      setState(() {}); // revert toggle visual
    } finally {
      if (mounted) setState(() { _busy = false; });
    }
  }

  Future<void> _pickPushTime() async {
    final u = api.user ?? {};
    final initial = TimeOfDay(hour: (u['push_hour'] as num?)?.toInt() ?? 9, minute: (u['push_min'] as num?)?.toInt() ?? 0);
    final t = await showTimePicker(context: context, initialTime: initial);
    if (t != null) _save({'push_hour': t.hour, 'push_min': t.minute, 'subscribed': true});
  }

  Future<void> _linkTelegram() async {
    setState(() { _busy = true; });
    try {
      final data = await api.getTelegramLink();
      final link = data['link'] as String;
      await Clipboard.setData(ClipboardData(text: link));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Link disalin — buka di Telegram: $link'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) showSajiError(context, e);
    } finally {
      if (mounted) setState(() { _busy = false; });
    }
  }

  Future<void> _toggleTier() async {
    final isPro = api.user?['tier'] == 'premium';
    setState(() { _busy = true; });
    try {
      final data = await api.setTier(isPro ? 'free' : 'premium');
      api.user = data['user'] as Map<String, dynamic>?;
      setState(() {});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(isPro ? 'Turun ke Free' : 'Pro aktif — foto menu + remix terbuka!'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: SajiColors.primary,
        ));
      }
    } catch (e) {
      if (mounted) showSajiError(context, e);
    } finally {
      if (mounted) setState(() { _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = api.user ?? {};
    final name = u['full_name'] as String? ?? 'Koki';
    final email = u['email'] as String? ?? '';
    final isPro = u['tier'] == 'premium';
    final pushH = (u['push_hour'] as num?)?.toInt();
    final pushM = (u['push_min'] as num?)?.toInt();
    final subscribed = u['subscribed'] == true || u['subscribed'] == 1;

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
                decoration: const BoxDecoration(gradient: SajiGradient.streakHero, shape: BoxShape.circle),
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
                    Row(children: [
                      Flexible(child: Text(name, style: SajiText.h3, overflow: TextOverflow.ellipsis)),
                      if (isPro) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [SajiColors.accent, SajiColors.amber400]),
                            borderRadius: BorderRadius.circular(SajiRadius.pill),
                          ),
                          child: const Text('Pro', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: SajiColors.brown900)),
                        ),
                      ],
                    ]),
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
              Row(children: [
                _pill('${u['target_calories'] ?? '—'} kal', SajiColors.primary),
                const SizedBox(width: 8),
                _pill('${u['target_protein'] ?? '—'}g protein', SajiColors.accent),
              ]),
            ],
          ),
        ),
        const SizedBox(height: SajiSpace.s4),

        _ToggleTile(emoji: '👶', title: 'Mode Ramah Anak', value: u['kid_friendly'] == true,
            onChanged: _busy ? null : (v) => _save({'kid_friendly': v})),
        _ToggleTile(emoji: '⚡', title: 'Meal 30 Menit', value: u['quick_meals'] == true,
            onChanged: _busy ? null : (v) => _save({'quick_meals': v})),
        _ToggleTile(emoji: '🔔', title: 'Langganan harian',
            subtitle: pushH != null ? 'Push jam ${pushH.toString().padLeft(2, '0')}:${(pushM ?? 0).toString().padLeft(2, '0')} — tap untuk ubah' : 'Tap untuk atur jam push',
            value: subscribed,
            onChanged: _busy ? null : (v) => v ? _pickPushTime() : _save({'subscribed': false})),
        _SettingsTile(
          emoji: '📱', title: 'Telegram',
          subtitle: u['telegram_chat_id'] != null ? 'Terhubung ✓' : 'Tap untuk dapat link koneksi',
          subtitleColor: u['telegram_chat_id'] != null ? SajiColors.primary : null,
          onTap: u['telegram_chat_id'] != null ? null : (_busy ? null : _linkTelegram),
        ),
        _SettingsTile(
          emoji: '⭐', title: 'Saji Pro',
          subtitle: isPro ? 'Aktif — tap untuk downgrade (dev)' : 'Upgrade — Rp29rb/bulan (dev toggle)',
          subtitleColor: SajiColors.accent,
          onTap: _busy ? null : _toggleTier,
        ),
        const SizedBox(height: SajiSpace.s5),

        OutlinedButton.icon(
          onPressed: () async {
            await api.logout();
            widget.onLogout();
          },
          icon: const Icon(Icons.logout, color: SajiColors.danger, size: 18),
          label: const Text('Logout', style: TextStyle(color: SajiColors.danger)),
          style: OutlinedButton.styleFrom(side: const BorderSide(color: SajiColors.danger)),
        ),
        const SizedBox(height: 80),
      ],
    );
  }

  Widget _pill(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(SajiRadius.pill)),
      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color, fontFamily: 'JetBrains Mono')),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  final Color? subtitleColor;
  final VoidCallback? onTap;
  const _SettingsTile({required this.emoji, required this.title, required this.subtitle, this.subtitleColor, this.onTap});

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
        trailing: Icon(onTap != null ? Icons.chevron_right : Icons.check_circle_outline,
            color: onTap != null ? SajiColors.textFaint : SajiColors.primary, size: 20),
        dense: true,
        onTap: onTap,
      ),
    );
  }
}

class _ToggleTile extends StatelessWidget {
  final String emoji;
  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool>? onChanged;
  const _ToggleTile({required this.emoji, required this.title, this.subtitle, required this.value, this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: SajiSpace.s2),
      decoration: BoxDecoration(
        color: SajiColors.surface,
        borderRadius: BorderRadius.circular(SajiRadius.lg),
        border: Border.all(color: SajiColors.border),
      ),
      child: SwitchListTile(
        secondary: Text(emoji, style: const TextStyle(fontSize: 20)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: subtitle != null ? Text(subtitle!, style: const TextStyle(fontSize: 12, color: SajiColors.textSubtle)) : null,
        value: value,
        onChanged: onChanged,
        activeColor: SajiColors.primary,
        dense: true,
      ),
    );
  }
}
