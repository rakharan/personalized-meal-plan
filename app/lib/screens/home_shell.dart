import 'package:flutter/material.dart';
import '../theme/tokens.dart';
import 'dashboard.dart';
import 'kalender.dart';
import 'belanja.dart';
import 'profil.dart';

class HomeShell extends StatefulWidget {
  final VoidCallback onLogout;
  const HomeShell({super.key, required this.onLogout});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      const DashboardScreen(),
      const KalenderScreen(),
      const BelanjaScreen(),
      ProfilScreen(onLogout: widget.onLogout),
    ];
    return Scaffold(
      body: SafeArea(
        child: IndexedStack(index: _index, children: pages),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() { _index = i; }),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: SajiColors.primary,
        unselectedItemColor: SajiColors.textMuted,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dinner_dining_outlined), activeIcon: Icon(Icons.dinner_dining), label: 'Dasbor'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_month_outlined), activeIcon: Icon(Icons.calendar_month), label: 'Kalender'),
          BottomNavigationBarItem(icon: Icon(Icons.shopping_basket_outlined), activeIcon: Icon(Icons.shopping_basket), label: 'Belanja'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profil'),
        ],
      ),
    );
  }
}
