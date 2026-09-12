import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';
import '../theme/tokens.dart';

// Streak hero — gradient card, animated Noto fire (lottie), number, progress to 7 days.
// Optional weekDots: 7 booleans (Mon..Sun) for cooked days.
class StreakHero extends StatelessWidget {
  final int streak;
  final List<bool>? weekDots;
  const StreakHero({super.key, required this.streak, this.weekDots});

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
          Lottie.asset(
            'assets/fire-noto.json',
            width: 56,
            height: 56,
            repeat: true,
            // ponytail: static emoji fallback if decode fails — drop when lottie proven stable on devices
            errorBuilder: (ctx, err, st) => const Text('🔥', style: TextStyle(fontSize: 36)),
          ),
          const SizedBox(width: SajiSpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$streak', style: SajiText.monoLg.copyWith(color: Colors.white, fontSize: 28)),
                Text('hari beruntun', style: SajiText.bodySm.copyWith(color: Colors.white.withOpacity(0.9))),
                if (weekDots != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: List.generate(7, (i) {
                      const labels = ['S', 'S', 'R', 'K', 'J', 'S', 'M'];
                      final done = weekDots![i];
                      final isToday = i == (DateTime.now().weekday - 1);
                      return Container(
                        width: 22, height: 22,
                        margin: const EdgeInsets.only(right: 5),
                        decoration: BoxDecoration(
                          color: done ? SajiColors.amber500 : Colors.white.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(8),
                          border: isToday ? Border.all(color: const Color(0xFFFFD27A), width: 2) : null,
                        ),
                        child: Center(
                          child: Text(labels[i],
                              style: TextStyle(
                                fontSize: 10, fontWeight: FontWeight.w700,
                                color: done ? SajiColors.brown900 : Colors.white.withOpacity(0.5),
                              )),
                        ),
                      );
                    }),
                  ),
                ],
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
