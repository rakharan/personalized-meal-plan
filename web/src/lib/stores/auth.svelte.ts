// Saji user auth store — JWT-based, separate from admin auth
// No coupling to api store — uses plain fetch

class AuthState {
  user = $state<any>(null);
  loading = $state(false);

  get token(): string | null {
    return localStorage.getItem('saji-user-token');
  }

  get isAuthed(): boolean {
    return !!this.token;
  }

  async register(email: string, password: string, fullName: string): Promise<boolean> {
    this.loading = true;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal daftar');
      localStorage.setItem('saji-user-token', data.token);
      this.user = data.user;
      return true;
    } finally {
      this.loading = false;
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    this.loading = true;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal login');
      localStorage.setItem('saji-user-token', data.token);
      this.user = data.user;
      return true;
    } finally {
      this.loading = false;
    }
  }

  async fetchMe(): Promise<void> {
    if (!this.token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) {
        this.logout();
        return;
      }
      const data = await res.json();
      this.user = data.user;
    } catch {
      this.logout();
    }
  }

  logout() {
    localStorage.removeItem('saji-user-token');
    this.user = null;
  }

  authHeaders(): Record<string, string> {
    const token = this.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

export const auth = new AuthState();
