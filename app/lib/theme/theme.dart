import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'tokens.dart';

ThemeData sajiTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  final jakarta = GoogleFonts.plusJakartaSansTextTheme(base.textTheme);
  return base.copyWith(
    scaffoldBackgroundColor: SajiColors.bg,
    colorScheme: const ColorScheme.dark(
      primary: SajiColors.primary,
      secondary: SajiColors.accent,
      surface: SajiColors.surface,
      error: SajiColors.danger,
      onPrimary: SajiColors.brown900,
      onSurface: SajiColors.text,
    ),
    textTheme: jakarta,
    cardColor: SajiColors.surface,
    dividerColor: SajiColors.border,
    appBarTheme: const AppBarTheme(
      backgroundColor: SajiColors.bg,
      elevation: 0,
      centerTitle: false,
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: SajiColors.surface,
      selectedItemColor: SajiColors.primary,
      unselectedItemColor: SajiColors.textSubtle,
      type: BottomNavigationBarType.fixed,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: SajiColors.primary,
        foregroundColor: SajiColors.brown900,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SajiRadius.pill)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: SajiColors.text,
        side: const BorderSide(color: SajiColors.borderStrong),
        minimumSize: const Size(0, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SajiRadius.pill)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: SajiColors.surface2,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(SajiRadius.lg),
        borderSide: const BorderSide(color: SajiColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(SajiRadius.lg),
        borderSide: const BorderSide(color: SajiColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(SajiRadius.lg),
        borderSide: const BorderSide(color: SajiColors.primary, width: 2),
      ),
      hintStyle: const TextStyle(color: SajiColors.textFaint),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
  );
}
