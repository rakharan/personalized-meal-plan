import 'package:flutter/material.dart';
import '../api/api.dart';
import '../theme/tokens.dart';
import '../widgets/logo.dart';
import '../widgets/streak_hero.dart';
import '../widgets/plan_widgets.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _plan;
  List<dynamic> _meals = [];
  int _streak = 0;
  bool _cookedToday = false;
  bool _actionLoading = false;
  String? _groceryList;
  String? _groceryWeek;
  String? _cookingSteps;

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool _isToday(String? iso) {
    if (iso == null) return false;
    final d = DateTime.tryParse(iso);
    if (d == null) return false;
    final now = DateTime.now();
    return d.year == now.year && d.month == now.month && d.day == now.day;
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      await api.fetchMe();
      final data = await api.getHistory();
      final plans = (data['plans'] as List?) ?? [];
      _streak = (data['streak'] as num?)?.toInt() ?? 0;
      if (plans.isNotEmpty) {
        final p = plans.first as Map<String, dynamic>;
        _plan = p;
        _meals = (p['meals'] as List?) ?? [];
        _cookedToday = _isToday(p['cookedAt'] as String?);
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  Future<void> _generate() async {
    setState(() { _actionLoading = true; _error = null; _meals = []; });
    try {
      final data = await api.generatePlan();
      _plan = {
        'planText': data['plan'],
        'cuisine': data['cuisine'],
        'created': DateTime.now().toIso8601String(),
        'cookedAt': null,
      };
      _meals = (data['meals'] as List?) ?? [];
      _cookedToday = false;
    } catch (e) {
      _error = e.toString();
      await _load();
    } finally {
      if (mounted) setState(() { _actionLoading = false; });
    }
  }

  Future<void> _markCooked() async {
    setState(() { _actionLoading = true; });
    try {
      final data = await api.markCooked(_plan?['id'] as int?);
      setState(() {
        _cookedToday = true;
        _streak = (data['streak'] as num?)?.toInt() ?? _streak;
      });
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() { _actionLoading = false; });
    }
  }

  Future<void> _grocery() async {
    setState(() { _actionLoading = true; });
    try {
      final data = await api.getGroceryList();
      setState(() {
        _groceryList = data['list'] as String?;
        _groceryWeek = data['week'] as String?;
      });
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() { _actionLoading = false; });
    }
  }

  Future<void> _cooking() async {
    setState(() { _actionLoading = true; });
    try {
      final data = await api.getCookingSteps();
      setState(() { _cookingSteps = data['steps'] as String?; });
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() { _actionLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: SajiColors.primary));
    }
    final name = (api.user?['full_name'] as String? ?? 'Koki').split(' ').first;
    final isPro = api.user?['tier'] == 'premium';
    final isTodayPlan = _isToday(_plan?['created'] as String?);

    return RefreshIndicator(
      onRefresh: _load,
      color: SajiColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(SajiSpace.s4),
        children: [
          if (_streak > 0) ...[
            StreakHero(streak: _streak),
            const SizedBox(height: SajiSpace.s4),
          ],
          Row(
            children: [
              Text('Halo, $name! 👋', style: SajiText.h1),
              if (isPro)
                Container(
                  margin: const EdgeInsets.only(left: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [SajiColors.accent, SajiColors.amber400]),
                    borderRadius: BorderRadius.circular(SajiRadius.pill),
                  ),
                  child: const Text('Pro ✓',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: SajiColors.brown900)),
                ),
            ],
          ),
          const SizedBox(height: SajiSpace.s4),

          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: SajiSpace.s3),
              child: Text(_error!, style: const TextStyle(color: SajiColors.danger, fontSize: 13)),
            ),

          if (_plan == null && !_actionLoading)
            _EmptyPlan(onGenerate: _generate, loading: _actionLoading)
          else ...[
            ShimmerCard(
              child: Padding(
                padding: const EdgeInsets.all(SajiSpace.s4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(isTodayPlan ? 'Hari ini' : 'Terakhir', style: SajiText.h2),
                        const Spacer(),
                        if (_cookedToday)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: SajiColors.primary,
                              borderRadius: BorderRadius.circular(SajiRadius.pill),
                            ),
                            child: const Text('✓ Sudah masak',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: SajiColors.brown900)),
                          )
                        else if (_plan?['cuisine'] != null)
                          CuisineTag('${_cuisineEmoji(_plan!['cuisine'])} ${_plan!['cuisine']}'),
                      ],
                    ),
                    if (!isTodayPlan) ...[
                      const SizedBox(height: SajiSpace.s2),
                      GestureDetector(
                        onTap: _actionLoading ? null : _generate,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: SajiColors.accentSoft,
                            borderRadius: BorderRadius.circular(SajiRadius.md),
                          ),
                          child: Text('Ini plan kemarin. Bikin plan hari ini →',
                              style: TextStyle(color: SajiColors.accent, fontSize: 13, fontWeight: FontWeight.w600),
                              textAlign: TextAlign.center),
                        ),
                      ),
                    ],
                    if (_actionLoading && _meals.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Center(child: CircularProgressIndicator(color: SajiColors.primary)),
                      )
                    else
                      ..._meals.map((m) => MealTile(
                            name: m['name'] ?? '',
                            items: ((m['items'] as List?) ?? []).cast<String>(),
                            kcal: (m['kcal'] as num?)?.toInt() ?? 0,
                            protein: (m['protein'] as num?)?.toInt() ?? 0,
                            carbs: (m['carbs'] as num?)?.toInt() ?? 0,
                            fat: (m['fat'] as num?)?.toInt() ?? 0,
                            imagePath: m['imagePath'] as String?,
                            isPro: isPro,
                          )),
                  ],
                ),
              ),
            ),
            const SizedBox(height: SajiSpace.s4),
            if (!_cookedToday && _meals.isNotEmpty)
              ElevatedButton.icon(
                onPressed: _actionLoading ? null : _markCooked,
                icon: const Text('✓'),
                label: const Text('Sudah masak'),
              ),
            const SizedBox(height: SajiSpace.s2),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _actionLoading ? null : _grocery,
                    child: const Text('🛒 Belanja'),
                  ),
                ),
                const SizedBox(width: SajiSpace.s2),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _actionLoading ? null : _cooking,
                    child: const Text('🍳 Panduan'),
                  ),
                ),
              ],
            ),
            TextButton(
              onPressed: _actionLoading ? null : _generate,
              child: Text('Ganti rencana hari ini ↻',
                  style: TextStyle(color: SajiColors.textFaint, fontSize: 13)),
            ),
          ],

          if (_groceryList != null) _ResultCard(
            emoji: '🛒', title: 'Daftar Belanja', subtitle: _groceryWeek ?? '',
            body: _groceryList!, color: SajiColors.primary,
          ),
          if (_cookingSteps != null) _ResultCard(
            emoji: '🍳', title: 'Panduan Masak', subtitle: 'Langkah demi langkah',
            body: _cookingSteps!, color: SajiColors.accent,
          ),
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  String _cuisineEmoji(String? c) {
    if (c == null) return '🍽️';
    final k = c.toLowerCase();
    const map = {
      'indonesia': '🍛', 'japan': '🍱', 'jepang': '🍱', 'korea': '🍲',
      'mediterranean': '🫒', 'mediterania': '🫒', 'thai': '🍜',
      'vietnam': '🥢', 'india': '🫓', 'mexic': '🌮', 'meksiko': '🌮',
    };
    for (final e in map.entries) {
      if (k.contains(e.key)) return e.value;
    }
    return '🍽️';
  }
}

class _EmptyPlan extends StatelessWidget {
  final VoidCallback onGenerate;
  final bool loading;
  const _EmptyPlan({required this.onGenerate, required this.loading});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(SajiSpace.s8),
      decoration: BoxDecoration(
        color: SajiColors.surface,
        borderRadius: SajiRadius.cardA,
        border: Border.all(color: SajiColors.border),
      ),
      child: Column(
        children: [
          const Text('🍽️', style: TextStyle(fontSize: 56)),
          const SizedBox(height: SajiSpace.s3),
          Text('Dapur masih kosong!', style: SajiText.h2),
          const SizedBox(height: SajiSpace.s2),
          Text('Belum ada rencana makan. Satu klik aja — semua siap diatur.',
              style: SajiText.bodySm, textAlign: TextAlign.center),
          const SizedBox(height: SajiSpace.s4),
          ElevatedButton(
            onPressed: loading ? null : onGenerate,
            child: const Text('🍽️ Bikin Rencana Pertama'),
          ),
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  final String body;
  final Color color;
  const _ResultCard({required this.emoji, required this.title, required this.subtitle, required this.body, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: SajiSpace.s4),
      decoration: BoxDecoration(
        color: SajiColors.surface,
        borderRadius: SajiRadius.cardB,
        border: Border.all(color: SajiColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(SajiSpace.s3),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(20), topRight: Radius.circular(24),
              ),
            ),
            child: Row(
              children: [
                Text(emoji, style: const TextStyle(fontSize: 20)),
                const SizedBox(width: SajiSpace.s2),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontWeight: FontWeight.w700, color: color)),
                    Text(subtitle, style: SajiText.caption),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(SajiSpace.s4),
            child: Text(body, style: SajiText.bodySm.copyWith(height: 1.6)),
          ),
        ],
      ),
    );
  }
}
