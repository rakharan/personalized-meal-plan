import 'dart:ui';
import 'package:flutter/material.dart';
import '../api/api.dart';
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
  final String? imagePath;
  final bool isPro;
  final VoidCallback? onTap;

  const MealTile({
    super.key,
    required this.name,
    required this.items,
    this.kcal = 0,
    this.protein = 0,
    this.carbs = 0,
    this.fat = 0,
    this.imagePath,
    this.isPro = false,
    this.onTap,
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
    return GestureDetector(
      onTap: onTap,
      child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (imagePath != null) _MealPhoto(imagePath: imagePath!, isPro: isPro),
        Padding(
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
        ),
      ],
      ),
    );
  }
}

// Pulsing photo placeholder while recipe image loads
class _PhotoShimmer extends StatefulWidget {
  const _PhotoShimmer();
  @override
  State<_PhotoShimmer> createState() => _PhotoShimmerState();
}

class _PhotoShimmerState extends State<_PhotoShimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat(reverse: true);

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (ctx, _) => Container(
        color: Color.lerp(SajiColors.surface2, SajiColors.surface3, _ctrl.value),
      ),
    );
  }
}

// Recipe photo — Pro sharp, free blurred + badge
class _MealPhoto extends StatelessWidget {
  final String imagePath;
  final bool isPro;
  const _MealPhoto({required this.imagePath, required this.isPro});

  @override
  Widget build(BuildContext context) {
    final url = imagePath.startsWith('http') ? imagePath : '${Api.baseUrl}$imagePath';
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      child: SizedBox(
        height: 130,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(
              url,
              fit: BoxFit.cover,
              loadingBuilder: (ctx, child, progress) => progress == null
                  ? child
                  : const _PhotoShimmer(),
              errorBuilder: (ctx, err, st) => Container(color: SajiColors.surface2),
            ),
            if (!isPro) ...[
              // Blur + dim overlay for free users
              BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: Container(color: Colors.black.withOpacity(0.45)),
              ),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [SajiColors.accent, SajiColors.amber400]),
                        borderRadius: BorderRadius.circular(SajiRadius.pill),
                      ),
                      child: const Text('Pro ✓',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: SajiColors.brown900)),
                    ),
                    const SizedBox(height: 6),
                    const Text('Buka foto menu dengan Pro',
                        style: TextStyle(fontSize: 11, color: SajiColors.textMuted, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ],
        ),
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
