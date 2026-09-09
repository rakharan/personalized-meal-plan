# Saji Mobile App — Design References

Approved screen directions (from superdesign, saved locally — no external dependency):

- `dashboard.html` — streak hero, today's plan card, Sudah masak primary, bottom nav
- `login.html` — logo hero, email/password, Masuk CTA
- `kalender.html` — week strip, streak card, progress ring, badges grid
- `belanja.html` — categorized grocery list with quantities
- `profil.html` — goal summary, settings list, Pro upgrade, logout

`tokens.dart` — Flutter design tokens mirroring `web/src/lib/styles/tokens.css`.

## Workflow for new screens (option 1: agent-as-designer)

1. Ask for screen → agent writes Flutter code directly using tokens.dart + patterns from these HTML refs
2. Run on device with hot reload (`flutter run`) — iterate live
3. Big new flows needing visual exploration first → superdesign free tier (300/mo) or local LLM proxy mockup
