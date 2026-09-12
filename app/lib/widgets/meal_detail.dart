import 'dart:ui';
import 'package:flutter/material.dart';
import '../api/api.dart';
import '../theme/tokens.dart';

// Meal detail bottom sheet — photo, macros, ingredients, per-meal panduan masak (lazy, cached server-side)
void showMealDetail(BuildContext context, {
  required String name,
  required List<String> items,
  required int kcal,
  required int protein,
  required int carbs,
  required int fat,
  String? imagePath,
  bool isPro = false,
  VoidCallback? onCooked,
}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (ctx) => Container(
      decoration: const BoxDecoration(
        color: SajiColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: _MealDetailSheet(
        name: name, items: items, kcal: kcal, protein: protein, carbs: carbs, fat: fat,
        imagePath: imagePath, isPro: isPro, onCooked: onCooked,
      ),
    ),
  );
}

class _MealDetailSheet extends StatefulWidget {
  final String name;
  final List<String> items;
  final int kcal, protein, carbs, fat;
  final String? imagePath;
  final bool isPro;
  final VoidCallback? onCooked;
  const _MealDetailSheet({
    required this.name, required this.items,
    required this.kcal, required this.protein, required this.carbs, required this.fat,
    this.imagePath, this.isPro = false, this.onCooked,
  });

  @override
  State<_MealDetailSheet> createState() => _MealDetailSheetState();
}

class _MealDetailSheetState extends State<_MealDetailSheet> {
  String? _steps;
  bool _loadingSteps = true;

  @override
  void initState() {
    super.initState();
    _loadSteps();
  }

  Future<void> _loadSteps() async {
    try {
      final data = await api.getMealSteps(widget.name);
      if (mounted) setState(() { _steps = data['steps'] as String?; _loadingSteps = false; });
    } catch (_) {
      if (mounted) setState(() { _loadingSteps = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.92,
      expand: false,
      builder: (ctx, scrollCtrl) => SingleChildScrollView(
        controller: scrollCtrl,
        padding: const EdgeInsets.fromLTRB(SajiSpace.s5, 12, SajiSpace.s5, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4,
                decoration: BoxDecoration(color: SajiColors.border, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: SajiSpace.s4),
            if (widget.imagePath != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: SizedBox(
                  height: 150, width: double.infinity,
                  child: Stack(fit: StackFit.expand, children: [
                    Image.network(
                      '${Api.baseUrl}${widget.imagePath}',
                      fit: BoxFit.cover,
                      errorBuilder: (c, e, s) => Container(color: SajiColors.surface2),
                    ),
                    if (!widget.isPro)
                      BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                        child: Container(color: Colors.black.withOpacity(0.45)),
                      ),
                    Positioned(
                      left: 10, bottom: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: SajiColors.brown900.withOpacity(0.85),
                          borderRadius: BorderRadius.circular(SajiRadius.pill),
                        ),
                        child: Text('~${widget.kcal} kkal · ${widget.protein}g protein',
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ]),
                ),
              ),
            const SizedBox(height: SajiSpace.s3),
            Text(widget.name, style: SajiText.h2),
            const SizedBox(height: SajiSpace.s2),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _macro('${widget.kcal}', 'kkal'),
              _macro('${widget.protein}g', 'protein'),
              _macro('${widget.carbs}g', 'karbo'),
              _macro('${widget.fat}g', 'lemak'),
            ]),
            const SizedBox(height: SajiSpace.s4),
            _section('Bahan'),
            ...widget.items.map((i) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(width: 5, height: 5, margin: const EdgeInsets.only(top: 7, right: 8),
                    decoration: const BoxDecoration(color: SajiColors.amber500, shape: BoxShape.circle)),
                Expanded(child: Text(i, style: SajiText.body)),
              ]),
            )),
            const SizedBox(height: SajiSpace.s4),
            _section('Panduan masak'),
            if (_loadingSteps)
              const Center(child: Padding(
                padding: EdgeInsets.all(20),
                child: CircularProgressIndicator(strokeWidth: 2, color: SajiColors.primary),
              ))
            else if (_steps != null)
              Text(_steps!, style: SajiText.body.copyWith(height: 1.55))
            else
              Text('Panduan belum tersedia.', style: SajiText.bodySm),
            if (widget.onCooked != null) ...[
              const SizedBox(height: SajiSpace.s5),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () { widget.onCooked!(); Navigator.pop(ctx); },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: SajiColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text('✓ Sudah masak', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _macro(String v, String label) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(
      color: SajiColors.surface2,
      border: Border.all(color: SajiColors.border),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text('$v $label', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: SajiColors.text)),
  );

  Widget _section(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(t.toUpperCase(),
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: SajiColors.primary)),
  );
}
