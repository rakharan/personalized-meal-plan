// Saji API store — talks to Express backend

class ApiState {
  baseUrl = $state('');

  async request(path: string, opts: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...opts.headers,
      },
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().catch(() => '')}`);
    return res.status === 204 ? null : res.json();
  }

  // ── Auth ──
  async login(token: string): Promise<boolean> {
    localStorage.setItem('saji-admin-token', token);
    try {
      await this.getStats();
      return true;
    } catch {
      localStorage.removeItem('saji-admin-token');
      return false;
    }
  }

  logout() {
    localStorage.removeItem('saji-admin-token');
  }

  get isAuthed(): boolean {
    return !!localStorage.getItem('saji-admin-token');
  }

  private authHeaders(): Record<string, string> {
    const token = localStorage.getItem('saji-admin-token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // ── Endpoints ──
  async getStats(): Promise<any> {
    return this.request('/api/stats', { headers: this.authHeaders() });
  }

  async getOverview(): Promise<any> {
    return this.request('/api/overview', { headers: this.authHeaders() });
  }

  async getUsers(page = 1): Promise<any> {
    return this.request(`/api/users?page=${page}`, { headers: this.authHeaders() });
  }

  async getPlans(): Promise<any> {
    return this.request('/api/plans', { headers: this.authHeaders() });
  }

  async getFeedback(): Promise<any> {
    return this.request('/api/feedback', { headers: this.authHeaders() });
  }

  async getUsage(): Promise<any> {
    return this.request('/api/usage', { headers: this.authHeaders() });
  }

  async getReferrals(): Promise<any> {
    return this.request('/api/referrals', { headers: this.authHeaders() });
  }
}

export const api = new ApiState();
