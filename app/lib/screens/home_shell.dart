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
      body: SafeArea(child: pages[_index]),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() { _index = i; }),
        items: const [
          BottomNavigationBarItem(icon: Text('🍽️', style: TextStyle(fontSize: 20)), label: 'Dasbor'),
          BottomNavigationBarItem(icon: Text('📅', style: TextStyle(fontSize: 20)), label: 'Kalender'),
          BottomNavigationBarItem(icon: Text('🛒', style: TextStyle(fontSize: 20)), label: 'Belanja'),
          BottomNavigationBarItem(icon: Text('👤', style: TextStyle(fontSize: 20)), label: 'Profil'),
        ],
      ),
    );
  }
}
