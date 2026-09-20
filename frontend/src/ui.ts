import { logout } from './auth';

export function money(amount: string, currency = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : `${currency} `;
  return `${symbol}${amount}`;
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function statusClass(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'badge badge-open';
    case 'COMPLETED':
      return 'badge badge-done';
    case 'INCOMPLETE_ENTRY':
    case 'INCOMPLETE_EXIT':
      return 'badge badge-warn';
    case 'CHARGED':
      return 'badge badge-done';
    case 'PENDING':
      return 'badge badge-open';
    default:
      return 'badge';
  }
}

export function mountNav(active: string): void {
  const el = document.querySelector('#nav');
  if (!el) return;

  const links = [
    { href: '/dashboard.html', id: 'dashboard', label: 'Dashboard' },
    { href: '/tap.html', id: 'tap', label: 'Simulate tap' },
    { href: '/journeys.html', id: 'journeys', label: 'Journeys' },
    { href: '/wallet.html', id: 'wallet', label: 'Wallet' },
  ];

  el.innerHTML = `
    <div class="nav-inner">
      <a class="brand-link" href="/dashboard.html">TransitPay</a>
      <nav class="nav-links">
        ${links
          .map(
            (l) =>
              `<a href="${l.href}" class="${l.id === active ? 'active' : ''}">${l.label}</a>`,
          )
          .join('')}
        <button type="button" class="linkish" id="logout-btn">Log out</button>
      </nav>
    </div>
  `;

  document.querySelector('#logout-btn')?.addEventListener('click', () => logout());
}

export function showError(el: HTMLElement | null, err: unknown): void {
  if (!el) return;
  el.hidden = false;
  el.textContent = err instanceof Error ? err.message : 'Something went wrong';
}

export function clearError(el: HTMLElement | null): void {
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
}
