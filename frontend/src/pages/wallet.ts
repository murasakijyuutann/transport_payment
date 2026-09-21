import { expireJourneys, getAccount, getCapStatus, getLedger, topUp } from '../api';
import { requireAuth } from '../auth';
import { clearError, formatWhen, money, mountNav, showError, statusClass } from '../ui';

requireAuth();
mountNav('wallet');

const errEl = document.querySelector<HTMLElement>('#error');
const balanceEl = document.querySelector<HTMLElement>('#balance');
const capEl = document.querySelector<HTMLElement>('#cap');
const ledgerBody = document.querySelector<HTMLElement>('#ledger-body');
const customInput = document.querySelector<HTMLInputElement>('#custom-amount');
const expireResult = document.querySelector<HTMLElement>('#expire-result');
const opsPanel = document.querySelector<HTMLElement>('#ops-panel');
const opsHint = document.querySelector<HTMLElement>('#ops-hint');

async function refresh() {
  clearError(errEl);
  try {
    const [account, ledger, cap] = await Promise.all([
      getAccount(),
      getLedger(),
      getCapStatus(),
    ]);
    if (balanceEl) {
      balanceEl.textContent = money(account.wallet.balance, account.wallet.currency);
    }
    if (capEl) {
      capEl.textContent = `${money(cap.remainingHeadroom)} left of ${money(cap.capAmount)} (used ${money(cap.chargedAmount)})`;
    }
    if (account.role === 'STAFF') {
      opsPanel?.removeAttribute('hidden');
      opsHint?.setAttribute('hidden', '');
    } else {
      opsPanel?.setAttribute('hidden', '');
      opsHint?.removeAttribute('hidden');
    }
    if (ledgerBody) {
      if (ledger.entries.length === 0) {
        ledgerBody.innerHTML = `<tr><td colspan="4" class="meta">No ledger entries yet.</td></tr>`;
      } else {
        ledgerBody.innerHTML = ledger.entries
          .map(
            (e) => `
          <tr>
            <td>${formatWhen(e.createdAt)}</td>
            <td><span class="${statusClass(e.type)}">${e.type}</span></td>
            <td class="mono">${e.amount.startsWith('-') ? `−£${e.amount.slice(1)}` : `+£${e.amount}`}</td>
            <td class="mono">${money(e.balanceAfter)}</td>
          </tr>
        `,
          )
          .join('');
      }
    }
  } catch (err) {
    showError(errEl, err);
  }
}

async function doTopUp(amount: number) {
  clearError(errEl);
  try {
    await topUp(amount);
    await refresh();
  } catch (err) {
    showError(errEl, err);
  }
}

document.querySelectorAll<HTMLButtonElement>('[data-topup]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const amount = Number(btn.dataset.topup);
    void doTopUp(amount);
  });
});

document.querySelector('#custom-topup')?.addEventListener('click', () => {
  const amount = Number(customInput?.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showError(errEl, new Error('Enter a positive amount'));
    return;
  }
  void doTopUp(amount);
});

document.querySelector('#expire-btn')?.addEventListener('click', async () => {
  clearError(errEl);
  try {
    const result = await expireJourneys();
    if (expireResult) {
      expireResult.textContent = `Expired ${result.expired} journey(s), charged ${result.charged}.`;
    }
    await refresh();
  } catch (err) {
    showError(errEl, err);
  }
});

void refresh();
