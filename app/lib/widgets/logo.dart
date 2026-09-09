import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../theme/tokens.dart';

// Saji wordmark — green text + amber underline (matches .saji-logo in web global.css)
class SajiLogo extends StatelessWidget {
  final double fontSize;
  const SajiLogo({super.key, this.fontSize = 28});

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Text(
          'saji',
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.03 * fontSize,
            color: SajiColors.primary,
            height: 1,
          ),
        ),
        Positioned(
          bottom: -0.25 * fontSize,
          left: 0,
          right: 0.28 * (fontSize * 2.2),
          child: Container(
            height: 0.13 * fontSize,
            decoration: BoxDecoration(
              color: SajiColors.accent,
              borderRadius: BorderRadius.circular(0.07 * fontSize),
            ),
          ),
        ),
      ],
    );
  }
}

// SVG logo asset (splash/login)
class SajiLogoImage extends StatelessWidget {
  final double size;
  const SajiLogoImage({super.key, this.size = 96});

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset('assets/logo.svg', width: size, height: size);
  }
}
