import { getAccount, getCapStatus } from '../api';
import { requireAuth } from '../auth';
import { money, mountNav, showError } from '../ui';

requireAuth();
mountNav('dashboard');

const errEl = document.querySelector<HTMLElement>('#error');
const root = document.querySelector<HTMLElement>('#dashboard');

async function load() {
  try {
    const [account, cap] = await Promise.all([getAccount(), getCapStatus()]);
    const tokens = account.media.map((m) => m.token).join(', ');
    if (!root) return;
    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat">
          <div class="label">Balance</div>
          <div class="value">${money(account.wallet.balance, account.wallet.currency)}</div>
        </div>
        <div class="stat">
          <div class="label">Rider</div>
          <div class="value">${account.riderCategory.name}</div>
          <div class="meta">${account.riderCategory.discountPercent}% discount</div>
        </div>
        <div class="stat">
          <div class="label">Daily cap left</div>
          <div class="value">${money(cap.remainingHeadroom)}</div>
          <div class="meta">${money(cap.chargedAmount)} / ${money(cap.capAmount)} used</div>
        </div>
      </div>
      <h2>Account</h2>
      <div class="panel stack">
        <div><strong>${account.firstName} ${account.lastName}</strong><div class="meta">${account.email}</div></div>
        <div>
          <div class="meta">Fare media token</div>
          <div class="mono" id="media-token">${tokens || '—'}</div>
          <button type="button" class="chip" id="copy-token" ${tokens ? '' : 'hidden'}>Copy token</button>
        </div>
      </div>
      <p class="meta actions" style="margin-top:1rem">
        <a href="/tap.html">Simulate a tap</a>
        <a href="/journeys.html">Journey history</a>
        <a href="/wallet.html">Top up / ledger</a>
      </p>
    `;
    document.querySelector('#copy-token')?.addEventListener('click', async () => {
      const first = account.media[0]?.token;
      if (first) await navigator.clipboard.writeText(first);
    });
  } catch (err) {
    showError(errEl, err);
  }
}

void load();
