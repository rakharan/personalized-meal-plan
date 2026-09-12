import 'dart:math';
import 'package:flutter/material.dart';
import '../theme/tokens.dart';

// Confetti burst overlay for "Sudah masak" reward moment (mockup C).
// Usage: StreakConfetti(controller: ...) wrapping the streak hero; call controller.forward() on cook.
class StreakConfetti extends StatefulWidget {
  final Widget child;
  final AnimationController controller;
  const StreakConfetti({super.key, required this.child, required this.controller});

  @override
  State<StreakConfetti> createState() => _StreakConfettiState();
}

class _StreakConfettiState extends State<StreakConfetti> {
  late final List<_Particle> _particles;
  final _rand = Random();
  static const _colors = [
    Color(0xFFFFD27A), Color(0xFFFF9A3D), SajiColors.primary,
    SajiColors.amber500, Color(0xFFFFF3D6),
  ];

  @override
  void initState() {
    super.initState();
    _particles = List.generate(16, (i) {
      final ang = (2 * pi * i) / 16 + _rand.nextDouble() * .5;
      final dist = 60 + _rand.nextDouble() * 60;
      return _Particle(
        color: _colors[i % _colors.length],
        dx: cos(ang) * dist,
        dy: sin(ang) * dist - 50,
        rot: _rand.nextDouble() * 4 * pi - 2 * pi,
        size: 6 + _rand.nextDouble() * 4,
        circle: i.isEven,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        widget.child,
        Positioned.fill(
          child: IgnorePointer(
            child: AnimatedBuilder(
              animation: widget.controller,
              builder: (ctx, _) {
                if (widget.controller.value == 0) return const SizedBox.shrink();
                final t = Curves.easeOut.transform(widget.controller.value);
                return Stack(
                  children: _particles.map((p) {
                    return Positioned(
                      left: 0, right: 0, top: 0, bottom: 0,
                      child: Transform.translate(
                        offset: Offset(p.dx * t, p.dy * t + 30 * t * t), // slight gravity
                        child: Transform.rotate(
                          angle: p.rot * t,
                          child: Opacity(
                            opacity: (1 - t).clamp(0.0, 1.0),
                            child: Center(
                              child: Container(
                                width: p.size, height: p.size,
                                decoration: BoxDecoration(
                                  color: p.color,
                                  shape: p.circle ? BoxShape.circle : BoxShape.rectangle,
                                  borderRadius: p.circle ? null : BorderRadius.circular(2),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _Particle {
  final Color color;
  final double dx, dy, rot, size;
  final bool circle;
  _Particle({required this.color, required this.dx, required this.dy, required this.rot, required this.size, required this.circle});
}
