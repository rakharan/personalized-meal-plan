import 'package:flutter/material.dart';
import '../api/api.dart';
import '../theme/tokens.dart';
import '../widgets/logo.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onAuthed;
  const LoginScreen({super.key, required this.onAuthed});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _register = false;
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() { _loading = true; _error = null; });
    try {
      if (_register) {
        await api.register(_email.text.trim(), _password.text, _name.text.trim());
      } else {
        await api.login(_email.text.trim(), _password.text);
      }
      widget.onAuthed();
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(SajiSpace.s6),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: SajiLogoImage(size: 88)),
                  const SizedBox(height: SajiSpace.s6),
                  Text('Makan enak hari ini.\nTanpa mikir.',
                      style: SajiText.h2, textAlign: TextAlign.center),
                  const SizedBox(height: SajiSpace.s8),
                  if (_register) ...[
                    TextField(
                      controller: _name,
                      decoration: const InputDecoration(hintText: 'Nama'),
                      textCapitalization: TextCapitalization.words,
                    ),
                    const SizedBox(height: SajiSpace.s3),
                  ],
                  TextField(
                    controller: _email,
                    decoration: const InputDecoration(hintText: 'Email'),
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                  ),
                  const SizedBox(height: SajiSpace.s3),
                  TextField(
                    controller: _password,
                    decoration: const InputDecoration(hintText: 'Password'),
                    obscureText: true,
                    onSubmitted: (_) => _submit(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: SajiSpace.s3),
                    Text(_error!, style: const TextStyle(color: SajiColors.danger, fontSize: 13),
                        textAlign: TextAlign.center),
                  ],
                  const SizedBox(height: SajiSpace.s5),
                  ElevatedButton(
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(_register ? 'Daftar Gratis' : 'Masuk'),
                  ),
                  const SizedBox(height: SajiSpace.s3),
                  TextButton(
                    onPressed: () => setState(() { _register = !_register; _error = null; }),
                    child: Text(
                      _register ? 'Udah punya akun? Masuk' : 'Belum punya akun? Daftar gratis',
                      style: const TextStyle(color: SajiColors.textSubtle),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
