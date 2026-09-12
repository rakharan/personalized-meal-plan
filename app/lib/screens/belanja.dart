import 'package:flutter/material.dart';
import '../api/api.dart';
import '../theme/tokens.dart';
import '../widgets/error.dart';

class BelanjaScreen extends StatefulWidget {
  const BelanjaScreen({super.key});

  @override
  State<BelanjaScreen> createState() => _BelanjaScreenState();
}

class _BelanjaScreenState extends State<BelanjaScreen> {
  bool _loading = false;
  String? _error;
  String? _list;
  String? _week;
  int? _days;
  final Set<String> _checked = {};

  @override
  void initState() {
    super.initState();
    // Auto-load: server returns cached list instantly if generated before
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await api.getGroceryList();
      setState(() {
        _list = data['list'] as String?;
        _week = data['week'] as String?;
        _days = (data['daysCovered'] as num?)?.toInt();
      });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(SajiSpace.s4),
      children: [
        Row(
          children: [
            Text('Belanja', style: SajiText.h1),
            const Spacer(),
            if (_week != null) Text(_week!, style: SajiText.caption),
          ],
        ),
        const SizedBox(height: SajiSpace.s3),

        if (_list == null) ...[
          Container(
            padding: const EdgeInsets.all(SajiSpace.s8),
            decoration: BoxDecoration(
              color: SajiColors.surface,
              borderRadius: SajiRadius.cardA,
              border: Border.all(color: SajiColors.border),
            ),
            child: Column(
              children: [
                const Text('🛒', style: TextStyle(fontSize: 48)),
                const SizedBox(height: SajiSpace.s3),
                Text('Daftar belanja mingguan', style: SajiText.h3),
                const SizedBox(height: SajiSpace.s2),
                Text('Konsolidasi 7 hari plan jadi 1 list. Sekali belanja, seminggu beres.',
                    style: SajiText.bodySm, textAlign: TextAlign.center),
                const SizedBox(height: SajiSpace.s4),
                ElevatedButton(
                  onPressed: _loading ? null : _load,
                  child: _loading
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Bikin Daftar Belanja'),
                ),
              ],
            ),
          ),
        ] else ...[
          if (_days != null)
            Padding(
              padding: const EdgeInsets.only(bottom: SajiSpace.s3),
              child: Text('Dari $_days hari rencana', style: SajiText.caption),
            ),
          Container(
            padding: const EdgeInsets.all(SajiSpace.s4),
            decoration: BoxDecoration(
              color: SajiColors.surface,
              borderRadius: SajiRadius.cardA,
              border: Border.all(color: SajiColors.border),
            ),
            child: _buildList(_list!),
          ),
          const SizedBox(height: SajiSpace.s3),
          OutlinedButton.icon(
            onPressed: _loading ? null : _load,
            icon: const Text('↻'),
            label: const Text('Muat ulang'),
          ),
        ],

        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: SajiSpace.s3),
            child: SajiError(error: _error!, onRetry: _load),
          ),
        const SizedBox(height: 80),
      ],
    );
  }

  Widget _buildList(String raw) {
    // Parse sections (PROTEIN / SAYUR / KARBO / BUMBU / BUAH / LAINNYA headers)
    final lines = raw.split('\n');
    final sections = <Widget>[];
    final headerRe = RegExp(r'^(PROTEIN|SAYUR|KARBO|BUMBU|BUAH|LAINNYA|Protein|Sayur|Karbo|Bumbu|Buah|Lainnya)\s*:?\s*$');
    String? currentSection;
    final items = <String>[];

    void flush() {
      if (currentSection == null && items.isEmpty) return;
      if (currentSection != null) {
        sections.add(_SectionHeader(title: currentSection!));
      }
      for (final item in items) {
        sections.add(_CheckItem(
          text: item,
          checked: _checked.contains(item),
          onChanged: (v) => setState(() {
            v ? _checked.add(item) : _checked.remove(item);
          }),
        ));
      }
      items.clear();
    }

    for (final line in lines) {
      final t = line.trim();
      if (t.isEmpty) continue;
      if (headerRe.hasMatch(t.replaceAll(RegExp(r'[*#]'), '').trim())) {
        flush();
        currentSection = t.replaceAll(RegExp(r'[*#:]'), '').trim();
      } else if (t.startsWith('-') || t.startsWith('•') || t.startsWith('*')) {
        items.add(t.replaceFirst(RegExp(r'^[-•*]\s*'), ''));
      } else if (currentSection == null) {
        // preamble line — skip
      } else {
        items.add(t);
      }
    }
    flush();

    if (sections.isEmpty) {
      return Text(raw, style: SajiText.bodySm.copyWith(height: 1.6));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: sections);
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    final color = switch (title.toUpperCase()) {
      'PROTEIN' => SajiColors.primary,
      'SAYUR' => SajiColors.leaf400,
      'KARBO' => SajiColors.accent,
      'BUMBU' => SajiColors.cream200,
      'BUAH' => SajiColors.amber400,
      _ => SajiColors.textSubtle,
    };
    return Padding(
      padding: const EdgeInsets.only(top: SajiSpace.s4, bottom: SajiSpace.s2),
      child: Text(title.toUpperCase(),
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: color, letterSpacing: 0.5)),
    );
  }
}

class _CheckItem extends StatelessWidget {
  final String text;
  final bool checked;
  final ValueChanged<bool> onChanged;
  const _CheckItem({required this.text, required this.checked, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(!checked),
      borderRadius: BorderRadius.circular(SajiRadius.sm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Container(
              width: 22, height: 22,
              decoration: BoxDecoration(
                color: checked ? SajiColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: checked ? SajiColors.primary : SajiColors.borderStrong, width: 2),
              ),
              child: checked
                  ? const Icon(Icons.check, size: 14, color: SajiColors.brown900)
                  : null,
            ),
            const SizedBox(width: SajiSpace.s3),
            Expanded(
              child: Text(
                text,
                style: SajiText.body.copyWith(
                  decoration: checked ? TextDecoration.lineThrough : null,
                  color: checked ? SajiColors.textFaint : SajiColors.text,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
