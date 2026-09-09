import 'package:flutter/material.dart';
import '../theme/tokens.dart';

// Streak hero — gradient green card, flame, big mono number, progress to 7 days
class StreakHero extends StatelessWidget {
  final int streak;
  const StreakHero({super.key, required this.streak});

  @override
  Widget build(BuildContext context) {
    final pct = (streak / 7).clamp(0.0, 1.0);
    return Container(
      padding: const EdgeInsets.all(SajiSpace.s5),
      decoration: BoxDecoration(
        gradient: SajiGradient.streakHero,
        borderRadius: SajiRadius.cardA,
      ),
      child: Row(
        children: [
          const Text('🔥', style: TextStyle(fontSize: 36)),
          const SizedBox(width: SajiSpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$streak', style: SajiText.monoLg.copyWith(color: Colors.white, fontSize: 28)),
                Text('hari beruntun', style: SajiText.bodySm.copyWith(color: Colors.white.withOpacity(0.9))),
              ],
            ),
          ),
          SizedBox(
            width: 110,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('${(pct * 100).round()}%',
                    style: SajiText.monoSm.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(SajiRadius.pill),
                  child: LinearProgressIndicator(
                    value: pct,
                    minHeight: 6,
                    backgroundColor: Colors.white.withOpacity(0.25),
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                Text('menuju 7 hari', style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.8))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
