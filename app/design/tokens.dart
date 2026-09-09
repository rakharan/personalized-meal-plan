// Saji design tokens — mirrors web/src/lib/styles/tokens.css
// Single source of truth for the Flutter app. Edit here, not per-widget.
import 'package:flutter/material.dart';

class SajiColors {
  // Primitives
  static const brown900 = Color(0xFF1A1612);
  static const brown800 = Color(0xFF241F1B);
  static const brown700 = Color(0xFF2D2823);
  static const brown600 = Color(0xFF3A342E);
  static const cream100 = Color(0xFFE8E0D5);
  static const cream200 = Color(0xFFC4B8A8);
  static const cream300 = Color(0xFF8A7E72);
  static const leaf400 = Color(0xFF74C69D);
  static const leaf500 = Color(0xFF52B788);
  static const leaf600 = Color(0xFF2D6A4F);
  static const amber400 = Color(0xFFFCD34D);
  static const amber500 = Color(0xFFF59E0B);
  static const amber600 = Color(0xFFD97706);
  static const tomato500 = Color(0xFFE5484D);

  // Semantic (dark — default)
  static const bg = brown900;
  static const surface = brown800;
  static const surface2 = brown700;
  static const surface3 = brown600;
  static const text = cream100;
  static const textMuted = cream200;
  static const textSubtle = Color(0xFF948A7E);
  static const textFaint = Color(0xFF6B6157);
  static const primary = leaf500;
  static const primaryHover = leaf400;
  static const primaryDeep = leaf600;
  static const accent = amber500;
  static const accentDeep = amber600;
  static const danger = tomato500;
  static const primarySoft = Color(0x1F52B788);
  static const accentSoft = Color(0x1AF59E0B);
  static const border = Color(0x0FFFFFFF);
  static const borderStrong = Color(0x17FFFFFF);

  // Light theme
  static const lightBg = Color(0xFFFDF8F3);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightSurface2 = Color(0xFFF5F0E8);
  static const lightSurface3 = Color(0xFFEDE5D8);
  static const lightText = brown900;
  static const lightTextMuted = Color(0xFF4A4540);
}

class SajiText {
  static const fontFamily = 'Plus Jakarta Sans';
  static const monoFamily = 'JetBrains Mono';

  static const hero = TextStyle(fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -1.5, height: 1.08);
  static const h1 = TextStyle(fontSize: 24, fontWeight: FontWeight.w600, letterSpacing: -0.5);
  static const h2 = TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.3);
  static const h3 = TextStyle(fontSize: 16, fontWeight: FontWeight.w600);
  static const body = TextStyle(fontSize: 14, fontWeight: FontWeight.w400, height: 1.5);
  static const bodySm = TextStyle(fontSize: 12, fontWeight: FontWeight.w400, height: 1.5);
  static const caption = TextStyle(fontSize: 12, fontWeight: FontWeight.w500);
  static const monoLg = TextStyle(fontFamily: monoFamily, fontSize: 32, fontWeight: FontWeight.w700, letterSpacing: -0.5);
  static const monoMd = TextStyle(fontFamily: monoFamily, fontSize: 16, fontWeight: FontWeight.w500);
  static const monoSm = TextStyle(fontFamily: monoFamily, fontSize: 12, fontWeight: FontWeight.w500);
}

class SajiSpace {
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s5 = 20.0;
  static const s6 = 24.0;
  static const s7 = 28.0;
  static const s8 = 32.0;
  static const s10 = 40.0;
  static const s12 = 48.0;
}

class SajiRadius {
  static const sm = 6.0;
  static const md = 8.0;
  static const lg = 12.0;
  static const xl = 16.0;
  static const pill = 999.0;

  // Signature asymmetric card radii (hand-crafted feel)
  static const cardA = BorderRadius.only(
    topLeft: Radius.circular(24), topRight: Radius.circular(28),
    bottomLeft: Radius.circular(32), bottomRight: Radius.circular(20),
  );
  static const cardB = BorderRadius.only(
    topLeft: Radius.circular(20), topRight: Radius.circular(24),
    bottomLeft: Radius.circular(28), bottomRight: Radius.circular(16),
  );
}

class SajiShadow {
  static const elevation2 = [
    BoxShadow(color: Color(0x4D000000), blurRadius: 12, offset: Offset(0, 4)),
  ];
  static const primaryGlow = [
    BoxShadow(color: Color(0x4D2D6A4F), blurRadius: 20, offset: Offset(0, 4)),
  ];
}

class SajiMotion {
  static const micro = Duration(milliseconds: 150);
  static const small = Duration(milliseconds: 200);
  static const large = Duration(milliseconds: 300);
  static const standard = Cubic(0.4, 0, 0.2, 1);
  static const spring = Cubic(0.34, 1.56, 0.64, 1);
}

// Streak hero gradient + shimmer border (signature)
class SajiGradient {
  static const streakHero = LinearGradient(
    colors: [leaf600, leaf400],
    begin: Alignment.topLeft, end: Alignment.bottomRight,
  );
  static const shimmer = LinearGradient(
    colors: [leaf500, amber500, leaf500, amber500],
    stops: [0.0, 0.33, 0.66, 1.0],
  );
  static const cuisineTag = LinearGradient(
    colors: [primarySoft, accentSoft],
    begin: Alignment.topLeft, end: Alignment.bottomRight,
  );
}
