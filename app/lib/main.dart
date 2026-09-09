import 'package:flutter/material.dart';
import 'api/api.dart';
import 'theme/theme.dart';
import 'screens/login.dart';
import 'screens/home_shell.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await api.init();
  runApp(const SajiApp());
}

class SajiApp extends StatefulWidget {
  const SajiApp({super.key});

  @override
  State<SajiApp> createState() => _SajiAppState();
}

class _SajiAppState extends State<SajiApp> {
  bool _authed = api.isAuthed;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Saji',
      debugShowCheckedModeBanner: false,
      theme: sajiTheme(),
      home: _authed
          ? HomeShell(onLogout: () => setState(() { _authed = false; }))
          : LoginScreen(onAuthed: () => setState(() { _authed = true; })),
    );
  }
}
