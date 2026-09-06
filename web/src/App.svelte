<script lang="ts">
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { api } from '$lib/stores/api.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import Button from '$lib/components/Button.svelte';

  const routes = [
    // User auth — longest first
    { hash: '#/signup', label: 'Signup', loader: () => import('./routes/Signup.svelte'), public: true, userAuth: false },
    { hash: '#/login', label: 'User Login', loader: () => import('./routes/UserLogin.svelte'), public: true, userAuth: false },
    // User routes — require user auth
    { hash: '#/dashboard', label: 'User Dashboard', loader: () => import('./routes/UserDashboard.svelte'), public: true, userAuth: true },
    { hash: '#/profile', label: 'Profile', loader: () => import('./routes/Profile.svelte'), public: true, userAuth: true },
    { hash: '#/history', label: 'Plan History', loader: () => import('./routes/PlanHistory.svelte'), public: true, userAuth: true },
    { hash: '#/settings', label: 'Settings', loader: () => import('./routes/Settings.svelte'), public: true, userAuth: true },
    // Admin sub-routes — longest first
    { hash: '#/admin/users', label: 'Users', loader: () => import('./routes/Users.svelte'), public: false, userAuth: false },
    { hash: '#/admin/plans', label: 'Plans', loader: () => import('./routes/Plans.svelte'), public: false, userAuth: false },
    { hash: '#/admin/feedback', label: 'Feedback', loader: () => import('./routes/Feedback.svelte'), public: false, userAuth: false },
    { hash: '#/admin/usage', label: 'Usage', loader: () => import('./routes/Usage.svelte'), public: false, userAuth: false },
    { hash: '#/admin/referrals', label: 'Referrals', loader: () => import('./routes/Referrals.svelte'), public: false, userAuth: false },
    { hash: '#/admin', label: 'Admin Dashboard', loader: () => import('./routes/Dashboard.svelte'), public: false, userAuth: false },
    // Admin login
    { hash: '#/admin-login', label: 'Admin Login', loader: () => import('./routes/Login.svelte'), public: true, userAuth: false },
    // Dev tools — public
    { hash: '#/workshop', label: 'Workshop', loader: () => import('./routes/Workshop.svelte'), public: true, userAuth: false },
    { hash: '#/theme-editor', label: 'Theme Editor', loader: () => import('./routes/ThemeEditor.svelte'), public: true, userAuth: false },
    // Public — landing (last, shortest)
    { hash: '#/', label: 'Home', loader: () => import('./routes/Landing.svelte'), public: true, userAuth: false },
  ];

  let currentRoute = $state(routes[routes.length - 1]);
  let RouteComponent: any = $state(null);
  let routeError = $state('');

  let isHandling = false;

  async function handleHashChange() {
    if (isHandling) return;
    isHandling = true;

    try {
      const hash = window.location.hash || '#/';
      const route = routes.find(r => hash.startsWith(r.hash)) || routes[routes.length - 1];
      currentRoute = route;
      routeError = '';

      // Admin auth guard — use replaceState to avoid back-button trap
      if (!route.public && !api.isAuthed) {
        history.replaceState(null, '', '#/admin-login');
        const mod = await import('./routes/Login.svelte');
        RouteComponent = mod.default;
        return;
      }

      // User auth guard
      if (route.userAuth && !auth.isAuthed) {
        history.replaceState(null, '', '#/login');
        const mod = await import('./routes/UserLogin.svelte');
        RouteComponent = mod.default;
        return;
      }

      try {
        const mod = await route.loader();
        RouteComponent = mod.default;
      } catch (e: any) {
        routeError = e.message;
        RouteComponent = null;
      }
    } finally {
      isHandling = false;
    }
  }

  function retry() {
    routeError = '';
    handleHashChange();
  }

  onMount(() => {
    theme.init();
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  });
</script>

{#if routeError}
  <div style="padding:var(--space-8);max-width:600px;margin:0 auto;">
    <Alert variant="danger" title="Halaman nggak bisa dimuat">{routeError}</Alert>
    <div style="margin-top:var(--space-4);"><Button variant="secondary" onclick={retry}>Coba lagi</Button></div>
  </div>
{:else if RouteComponent}
  {#key currentRoute.hash}
    <RouteComponent {routes} currentHash={currentRoute.hash} />
  {/key}
{/if}
