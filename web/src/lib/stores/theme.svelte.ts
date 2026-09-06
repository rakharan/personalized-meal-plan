// Saji theme store — dark/light/auto switching
// ponytail: localStorage persistence. If more user prefs needed, refactor to a combined settings store.

type ThemeMode = 'dark' | 'light' | 'auto';

const STORAGE_KEY = 'saji-theme';

class ThemeState {
  mode = $state<ThemeMode>('auto');

  private apply() {
    const effective = this.mode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : this.mode;
    document.documentElement.setAttribute('data-theme', effective);
  }

  init() {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved) this.mode = saved;
    this.apply();

    // Listen for OS theme changes when in auto mode
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (this.mode === 'auto') this.apply();
    });
  }

  set(mode: ThemeMode) {
    this.mode = mode;
    localStorage.setItem(STORAGE_KEY, mode);
    this.apply();
  }

  get effective(): 'dark' | 'light' {
    if (this.mode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return this.mode;
  }
}

export const theme = new ThemeState();
