import 'package:flutter/material.dart';
import '../theme/tokens.dart';

class MacroPill extends StatelessWidget {
  final String label;
  final Color color;
  const MacroPill(this.label, this.color, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(SajiRadius.pill),
      ),
      child: Text(label, style: SajiText.monoSm.copyWith(color: color, fontSize: 11)),
    );
  }
}

// One meal row in today's plan card
class MealTile extends StatelessWidget {
  final String name;
  final List<String> items;
  final int kcal;
  final int protein;
  final int carbs;
  final int fat;

  const MealTile({
    super.key,
    required this.name,
    required this.items,
    this.kcal = 0,
    this.protein = 0,
    this.carbs = 0,
    this.fat = 0,
  });

  String get _emoji {
    final k = name.toLowerCase();
    if (k.contains('sarapan') || k.contains('breakfast')) return '🍳';
    if (k.contains('siang') || k.contains('lunch')) return '🍱';
    if (k.contains('malam') || k.contains('dinner')) return '🌙';
    return '🥗';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: SajiSpace.s3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: SajiSpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name.toUpperCase(), style: SajiText.h3),
                const SizedBox(height: 2),
                ...items.take(4).map((i) => Text(i,
                    style: SajiText.bodySm, maxLines: 1, overflow: TextOverflow.ellipsis)),
              ],
            ),
          ),
          const SizedBox(width: SajiSpace.s2),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (kcal > 0) MacroPill('$kcal kal', SajiColors.primary),
              const SizedBox(height: 4),
              if (protein > 0) MacroPill('${protein}g', SajiColors.accent),
            ],
          ),
        ],
      ),
    );
  }
}

// Cuisine tag pill — gradient soft
class CuisineTag extends StatelessWidget {
  final String text;
  const CuisineTag(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        gradient: SajiGradient.cuisineTag,
        borderRadius: BorderRadius.circular(SajiRadius.pill),
      ),
      child: Text(text,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: SajiColors.primary)),
    );
  }
}

// Card with shimmer gradient top border (signature)
class ShimmerCard extends StatelessWidget {
  final Widget child;
  const ShimmerCard({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: SajiColors.surface,
        borderRadius: SajiRadius.cardA,
        border: Border.all(color: SajiColors.border),
        boxShadow: SajiShadow.elevation2,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            height: 4,
            decoration: const BoxDecoration(
              gradient: SajiGradient.shimmer,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(24), topRight: Radius.circular(28),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}
