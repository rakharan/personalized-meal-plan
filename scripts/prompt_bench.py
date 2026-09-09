#!/usr/bin/env python3
"""
Saji prompt tuning bench — fast iteration on LLM prompts via local proxy.

Usage:
  python prompt_bench.py grocery          # run grocery-list prompt variants
  python prompt_bench.py remix            # run leftover-remix variants
  python prompt_bench.py --model prod/glm-5.3-flash grocery

Each task loads sample data (real plan text from DB or built-in fixture),
runs N prompt variants against the local proxy, prints outputs + parse checks.
You read outputs, pick the winning variant, paste it into src/llmClient.ts.
"""
import json
import sys
import time
import urllib.request

PROXY = "http://localhost:20128/v1/chat/completions"
DEFAULT_MODEL = "prod/auto"

# ── Sample data (from real plan id=12, keeps bench offline-runnable) ──
PLAN_SAMPLE = """Hari ini: Indonesia

Target: 3000 kkal, 100g protein. Plan: ~2980 kkal, 155g protein. Aman kacang, halal semua.

SARAPAN (~700 kkal, 25g protein, 95g karbo, 25g lemak)
- Nasi goreng: nasi 200g, telur 2 butir, tahu 100g, kecap manis, minyak 10g
- Pisang 1 buah

SNACK SIANG (~730 kkal, 40g protein, 75g karbo, 33g lemak)
- Tempe goreng 150g
- Nasi putih 150g
- Susu full cream 250ml

MAKAN SIANG (~650 kkal, 35g protein, 75g karbo, 15g lemak)
- Ikan kembung bakar 150g
- Nasi putih 250g
- Tumis kangkung (minyak 5g, bawang putih)

MAKAN MALAM (~900 kkal, 55g protein, 75g karbo, 35g lemak)
- Ayam bakar paha 150g (kecap manis marinasi)
- Nasi putih 200g
- Tumis tahu 100g
- Susu full cream 250ml

Catatan:
Semua bahan lokal, murah, mudah. Masak simple: goreng, bakar, tumis.
Hindari: pecel, sate bumbu kacang, rempeyek. Alergi kacang."""

# ── Task definitions: variants to test ──
TASKS = {
    "grocery": {
        "user": PLAN_SAMPLE,
        "check": lambda out: {
            "no_preamble": not out.lstrip().lower().startswith(("tentu", "berikut", "sure", "here")),
            "has_protein": "protein" in out.lower() or "ayam" in out.lower() or "ikan" in out.lower(),
            "no_markdown_fence": "```" not in out,
            "has_bumbu_cat": "bumbu" in out.lower(),
        },
        "variants": [
            ("current",
             "Asisten belanja. Ekstrak daftar belanja dari rencana makan: bahan + jumlah. Kelompokkan (Protein, Sayur, Lainnya). Tanpa disclaimer."),
            ("bumbu-cat",
             "Asisten belanja. Ekstrak daftar belanja dari rencana makan: bahan + jumlah. Kelompokkan ke kategori: Protein, Sayur, Karbo, Bumbu, Buah, Lainnya. Output HANYA daftar, tanpa preamble, tanpa markdown."),
            ("bumbu-cat-qty",
             "Asisten belanja. Ekstrak daftar belanja dari rencana makan: bahan + jumlah total (jumlahkan bahan yang sama antar meal). Kelompokkan: Protein, Sayur, Karbo, Bumbu, Buah, Lainnya. Format per baris: '- bahan — jumlah'. Output HANYA daftar, tanpa preamble, tanpa markdown, tanpa catatan."),
        ],
    },
    "remix": {
        "user": PLAN_SAMPLE,
        "check": lambda out: {
            "no_preamble": not out.lstrip().lower().startswith(("tentu", "berikut", "sure", "here")),
            "has_suggestions": "sisa" in out.lower() or "remix" in out.lower() or "suwir" in out.lower() or "→" in out,
            "no_markdown_fence": "```" not in out,
            "mentions_macros": "kkal" in out.lower() or "protein" in out.lower(),
        },
        "variants": [
            ("current",
             "Koki kreatif. Dari rencana kemarin, identifikasi bahan/sisa yang bisa dipakai lagi. Sarankan 2-3 meal baru dari sisa tersebut (contoh: ayam bakar → ayam suwir). Sertakan estimasi kalori+protein. Bahasa Indonesia, ringkas, tanpa disclaimer."),
            ("structured",
             "Koki kreatif. Dari rencana kemarin, identifikasi bahan yang tersisa. Untuk tiap saran meal: nama meal, bahan sisa yang dipakai, bahan tambahan (jika ada), estimasi kkal+protein. Maksimal 3 saran. Bahasa Indonesia santai, ringkas, tanpa preamble, tanpa markdown."),
        ],
    },
}


def call_llm(model: str, system: str, user: str, max_tokens: int = 2048) -> tuple[str, dict, float]:
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
        "stream": False,
    }
    req = urllib.request.Request(
        PROXY,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
    dt = time.time() - t0
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return content, usage, dt


def main():
    args = sys.argv[1:]
    model = DEFAULT_MODEL
    if "--model" in args:
        i = args.index("--model")
        model = args[i + 1]
        args = args[:i] + args[i + 2:]
    task_name = args[0] if args else None
    if task_name not in TASKS:
        print(f"usage: python prompt_bench.py [--model X] [{'|'.join(TASKS)}]")
        sys.exit(1)

    task = TASKS[task_name]
    print(f"=== task: {task_name} | model: {model} ===\n")
    for name, system in task["variants"]:
        try:
            out, usage, dt = call_llm(model, system, task["user"])
        except Exception as e:
            print(f"--- variant '{name}' FAILED: {e}\n")
            continue
        checks = task["check"](out)
        passed = sum(checks.values())
        print(f"--- variant '{name}' ({dt:.1f}s, {usage.get('total_tokens', '?')} tok, checks {passed}/{len(checks)}) ---")
        print(out)
        for k, v in checks.items():
            if not v:
                print(f"  ✗ check failed: {k}")
        print()


if __name__ == "__main__":
    main()
