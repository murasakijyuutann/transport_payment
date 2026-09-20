import { getAccount, listStations, postTap } from '../api';
import { requireAuth } from '../auth';
import { clearError, mountNav, showError } from '../ui';

requireAuth();
mountNav('tap');

const errEl = document.querySelector<HTMLElement>('#error');
const form = document.querySelector<HTMLFormElement>('#tap-form');
const mediaInput = document.querySelector<HTMLInputElement>('#mediaToken');
const validatorSelect = document.querySelector<HTMLSelectElement>('#validatorId');
const resultEl = document.querySelector<HTMLElement>('#result');

async function load() {
  try {
    const [account, stations] = await Promise.all([getAccount(), listStations()]);
    if (mediaInput) {
      mediaInput.value = account.media[0]?.token ?? '';
    }
    if (validatorSelect) {
      const options: string[] = [];
      for (const s of stations) {
        for (const v of s.validators) {
          options.push(
            `<option value="${v.validatorCode}">${s.name} · ${v.type.replace('_', ' ')} · ${v.validatorCode}</option>`,
          );
        }
      }
      validatorSelect.innerHTML = options.join('');
    }
  } catch (err) {
    showError(errEl, err);
  }
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(errEl);
  if (!resultEl) return;
  resultEl.textContent = 'Sending tap…';
  try {
    const mediaToken = mediaInput?.value.trim() ?? '';
    const validatorId = validatorSelect?.value ?? '';
    const result = await postTap(mediaToken, validatorId);
    resultEl.innerHTML = `
      <div class="ok"><strong>${result.tapType}</strong> ${result.status}</div>
      <div class="meta">Journey ${result.journeyStatus}</div>
      <div class="mono"><a href="/journey.html?id=${result.journeyId}">${result.journeyId}</a></div>
      <pre class="pre">${JSON.stringify(result, null, 2)}</pre>
    `;
  } catch (err) {
    resultEl.textContent = '';
    showError(errEl, err);
  }
});

void load();
