import 'package:flutter/material.dart';
import '../api/api.dart';
import '../theme/tokens.dart';
import '../widgets/error.dart';

// Full editable profile — targets, goal, cuisine, meals/day, allergies, restrictions, disliked
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final TextEditingController _name;
  late final TextEditingController _kcal;
  late final TextEditingController _protein;
  late final TextEditingController _allergies;
  late final TextEditingController _restrictions;
  late final TextEditingController _disliked;
  String _goal = 'general_health';
  String _cuisine = 'rotate';
  int _mealsPerDay = 3;
  bool _saving = false;

  static const _goals = {
    'general_health': 'Makan sehat',
    'weight_loss': 'Turun berat badan',
    'muscle_gain': 'Naik massa otot',
    'maintenance': 'Maintenance',
  };
  static const _cuisines = {
    'rotate': 'Rotasi (campur)',
    'id': 'Indonesia',
    'jp': 'Jepang',
    'kr': 'Korea',
    'md': 'Mediterania',
    'th': 'Thailand',
  };

  @override
  void initState() {
    super.initState();
    final u = api.user ?? {};
    _name = TextEditingController(text: u['full_name'] as String? ?? '');
    _kcal = TextEditingController(text: '${u['target_calories'] ?? ''}');
    _protein = TextEditingController(text: '${u['target_protein'] ?? ''}');
    _allergies = TextEditingController(text: u['allergies'] as String? ?? '');
    _restrictions = TextEditingController(text: u['dietary_restrictions'] as String? ?? '');
    _disliked = TextEditingController(text: u['disliked_ingredients'] as String? ?? '');
    _goal = _goals.containsKey(u['goal']) ? u['goal'] as String : 'general_health';
    _cuisine = _cuisines.containsKey(u['cuisine_rotation']) ? u['cuisine_rotation'] as String : 'rotate';
    _mealsPerDay = (u['meals_per_day'] as num?)?.toInt() ?? 3;
  }

  @override
  void dispose() {
    _name.dispose(); _kcal.dispose(); _protein.dispose();
    _allergies.dispose(); _restrictions.dispose(); _disliked.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() { _saving = true; });
    try {
      await api.updateProfile({
        'full_name': _name.text.trim(),
        'target_calories': int.tryParse(_kcal.text.trim()),
        'target_protein': int.tryParse(_protein.text.trim()),
        'goal': _goal,
        'cuisine_rotation': _cuisine,
        'meals_per_day': _mealsPerDay,
        'allergies': _allergies.text.trim(),
        'dietary_restrictions': _restrictions.text.trim(),
        'disliked_ingredients': _disliked.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Profil tersimpan ✓'),
          backgroundColor: SajiColors.primary,
          behavior: SnackBarBehavior.floating,
        ));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) showSajiError(context, e);
    } finally {
      if (mounted) setState(() { _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SajiColors.bg,
      appBar: AppBar(
        backgroundColor: SajiColors.bg,
        title: const Text('Edit Profil'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: SajiColors.primary))
                : const Text('Simpan', style: TextStyle(color: SajiColors.primary, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(SajiSpace.s4),
        children: [
          _field('Nama', _name),
          Row(children: [
            Expanded(child: _field('Target kalori', _kcal, hint: '2000', number: true, suffix: 'kkal')),
            const SizedBox(width: SajiSpace.s3),
            Expanded(child: _field('Target protein', _protein, hint: '100', number: true, suffix: 'g')),
          ]),
          _label('Goal'),
          _chips(_goals, _goal, (v) => setState(() { _goal = v; })),
          _label('Rotasi masakan'),
          _chips(_cuisines, _cuisine, (v) => setState(() { _cuisine = v; })),
          _label('Meal per hari'),
          Row(children: [2, 3, 4, 5].map((n) => Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text('$n'),
              selected: _mealsPerDay == n,
              onSelected: (_) => setState(() { _mealsPerDay = n; }),
              selectedColor: SajiColors.primary.withOpacity(0.25),
              labelStyle: TextStyle(
                color: _mealsPerDay == n ? SajiColors.primary : SajiColors.textMuted,
                fontWeight: FontWeight.w700,
              ),
            ),
          )).toList()),
          _field('Alergi', _allergies, hint: 'mis. kacang, udang, susu'),
          _field('Pantangan', _restrictions, hint: 'mis. halal, rendah garam'),
          _field('Bahan yang nggak suka', _disliked, hint: 'mis. petai, jengkol'),
          const SizedBox(height: SajiSpace.s5),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            style: ElevatedButton.styleFrom(
              backgroundColor: SajiColors.primary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: Text(_saving ? 'Menyimpan...' : 'Simpan perubahan',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white)),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _label(String t) => Padding(
    padding: const EdgeInsets.only(top: SajiSpace.s4, bottom: 8),
    child: Text(t.toUpperCase(),
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: SajiColors.primary)),
  );

  Widget _chips(Map<String, String> opts, String current, ValueChanged<String> onPick) {
    return Wrap(
      spacing: 8, runSpacing: 8,
      children: opts.entries.map((e) => ChoiceChip(
        label: Text(e.value),
        selected: current == e.key,
        onSelected: (_) => onPick(e.key),
        selectedColor: SajiColors.primary.withOpacity(0.25),
        labelStyle: TextStyle(
          color: current == e.key ? SajiColors.primary : SajiColors.textMuted,
          fontWeight: FontWeight.w600, fontSize: 13,
        ),
      )).toList(),
    );
  }

  Widget _field(String label, TextEditingController ctrl, {String? hint, bool number = false, String? suffix}) {
    return Padding(
      padding: const EdgeInsets.only(top: SajiSpace.s3),
      child: TextField(
        controller: ctrl,
        keyboardType: number ? TextInputType.number : TextInputType.text,
        style: const TextStyle(color: SajiColors.text, fontSize: 15),
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          suffixText: suffix,
          labelStyle: const TextStyle(color: SajiColors.textMuted, fontSize: 13),
          hintStyle: const TextStyle(color: SajiColors.textFaint, fontSize: 13),
          filled: true,
          fillColor: SajiColors.surface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: SajiColors.border)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: SajiColors.border)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: SajiColors.primary)),
        ),
      ),
    );
  }
}
