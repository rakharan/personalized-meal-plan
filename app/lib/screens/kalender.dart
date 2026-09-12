import 'package:flutter/material.dart';
import '../api/api.dart';
import '../theme/tokens.dart';

class KalenderScreen extends StatefulWidget {
  const KalenderScreen({super.key});

  @override
  State<KalenderScreen> createState() => _KalenderScreenState();
}

class _KalenderScreenState extends State<KalenderScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _days = [];
  List<dynamic> _badges = [];
  int _weekCooked = 0;
  int _weekTarget = 7;
  int _streak = 0;
  int _weekOffset = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool background = false}) async {
    if (!background) setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        api.getCalendar(_weekOffset),
        api.getBadges(),
        api.getHistory(),
      ]);
      _days = (results[0]['days'] as List?) ?? [];
      _badges = (results[1]['badges'] as List?) ?? [];
      _weekCooked = (results[1]['weekCooked'] as num?)?.toInt() ?? 0;
      _weekTarget = (results[1]['weekTarget'] as num?)?.toInt() ?? 7;
      _streak = (results[2]['streak'] as num?)?.toInt() ?? 0;
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  void _navWeek(int delta) {
    setState(() { _weekOffset += delta; });
    _load(background: true);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: SajiColors.primary));
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: SajiColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(SajiSpace.s4),
        children: [
          Row(
            children: [
              Text('Kalender', style: SajiText.h1),
              const Spacer(),
              IconButton(
                onPressed: () => _navWeek(-1),
                icon: const Icon(Icons.chevron_left, color: SajiColors.textSubtle),
              ),
              IconButton(
                onPressed: _weekOffset >= 0 ? null : () => _navWeek(1),
                icon: const Icon(Icons.chevron_right, color: SajiColors.textSubtle),
              ),
            ],
          ),
          const SizedBox(height: SajiSpace.s3),

          // Week strip — crossfades when week data swaps (no full-page reload)
          SizedBox(
            height: 96,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              child: Row(
                key: ValueKey(_days.isEmpty ? 'empty' : (_days.first as Map?)?['date'] ?? 'week'),
                children: _days.map((d) => Expanded(child: _DayCard(day: d))).toList(),
              ),
            ),
          ),
          const SizedBox(height: SajiSpace.s4),

          // Streak + ring row
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(SajiSpace.s4),
                  decoration: BoxDecoration(
                    gradient: SajiGradient.streakHero,
                    borderRadius: SajiRadius.cardB,
                  ),
                  child: Row(
                    children: [
                      const Text('🔥', style: TextStyle(fontSize: 28)),
                      const SizedBox(width: SajiSpace.s2),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('$_streak', style: SajiText.monoLg.copyWith(color: Colors.white, fontSize: 24)),
                          Text('hari beruntun', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.9))),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: SajiSpace.s3),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(SajiSpace.s4),
                  decoration: BoxDecoration(
                    color: SajiColors.surface,
                    borderRadius: SajiRadius.cardB,
                    border: Border.all(color: SajiColors.border),
                  ),
                  child: Column(
                    children: [
                      SizedBox(
                        width: 72, height: 72,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            CircularProgressIndicator(
                              value: _weekTarget > 0 ? (_weekCooked / _weekTarget).clamp(0.0, 1.0) : 0,
                              strokeWidth: 7,
                              backgroundColor: SajiColors.surface3,
                              valueColor: const AlwaysStoppedAnimation(SajiColors.primary),
                            ),
                            Text('$_weekCooked/$_weekTarget',
                                style: SajiText.monoMd.copyWith(color: SajiColors.primary, fontSize: 14)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text('minggu ini', style: SajiText.caption),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: SajiSpace.s5),

          Text('LENCANA', style: SajiText.caption.copyWith(letterSpacing: 1)),
          const SizedBox(height: SajiSpace.s3),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: SajiSpace.s3,
            crossAxisSpacing: SajiSpace.s3,
            childAspectRatio: 1.4,
            children: _badges.map((b) => _BadgeCard(badge: b)).toList(),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: SajiSpace.s3),
              child: Text(_error!, style: const TextStyle(color: SajiColors.danger)),
            ),
          const SizedBox(height: 80),
        ],
      ),
    );
  }
}

class _DayCard extends StatelessWidget {
  final Map<String, dynamic> day;
  const _DayCard({required this.day});

  @override
  Widget build(BuildContext context) {
    final status = day['status'] as String? ?? 'future';
    final (dotColor, dotText) = switch (status) {
      'cooked' => (SajiColors.primary, '✓'),
      'skipped' => (SajiColors.surface3, '✕'),
      'today' => (SajiColors.accent, '●'),
      _ => (SajiColors.surface2, '·'),
    };
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        color: status == 'cooked' ? SajiColors.primarySoft : SajiColors.surface,
        borderRadius: BorderRadius.circular(SajiRadius.lg),
        border: Border.all(
          color: status == 'today' ? SajiColors.primary : SajiColors.border,
          width: status == 'today' ? 2 : 1,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: 4, right: 4,
            child: Container(
              width: 18, height: 18,
              decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
              child: Center(
                child: Text(dotText,
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: SajiColors.brown900)),
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(day['dayName'] ?? '',
                    style: const TextStyle(fontSize: 10, color: SajiColors.textFaint, fontWeight: FontWeight.w600)),
                Text('${day['dayNum'] ?? ''}', style: SajiText.monoMd),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BadgeCard extends StatelessWidget {
  final Map<String, dynamic> badge;
  const _BadgeCard({required this.badge});

  @override
  Widget build(BuildContext context) {
    final unlocked = badge['unlocked'] == true;
    final progress = (badge['progress'] as num?)?.toDouble() ?? 0;
    return Opacity(
      opacity: unlocked ? 1 : 0.5,
      child: Container(
        padding: const EdgeInsets.all(SajiSpace.s3),
        decoration: BoxDecoration(
          color: SajiColors.surface,
          borderRadius: SajiRadius.cardB,
          border: Border.all(color: SajiColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: unlocked ? SajiColors.primarySoft : SajiColors.surface2,
                shape: BoxShape.circle,
              ),
              child: Center(child: Text(badge['emoji'] ?? '🏅', style: const TextStyle(fontSize: 22))),
            ),
            const SizedBox(height: 6),
            Text(badge['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                textAlign: TextAlign.center),
            Text(badge['desc'] ?? '', style: SajiText.caption.copyWith(fontSize: 10),
                textAlign: TextAlign.center, maxLines: 2),
            if (!unlocked) ...[
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(SajiRadius.pill),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 4,
                  backgroundColor: SajiColors.surface3,
                  valueColor: const AlwaysStoppedAnimation(SajiColors.primary),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
