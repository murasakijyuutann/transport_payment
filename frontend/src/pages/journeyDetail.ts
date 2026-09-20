import { getJourney, getJourneyFare } from '../api';
import { requireAuth } from '../auth';
import { formatWhen, money, mountNav, showError, statusClass } from '../ui';

requireAuth();
mountNav('journeys');

const errEl = document.querySelector<HTMLElement>('#error');
const root = document.querySelector<HTMLElement>('#detail');
const id = new URLSearchParams(location.search).get('id');

async function load() {
  if (!id) {
    showError(errEl, new Error('Missing journey id'));
    return;
  }
  try {
    const journey = await getJourney(id);
    let fareHtml = `<p class="meta">No fare yet (journey still open or unsettled).</p>`;
    try {
      const fare = await getJourneyFare(id);
      fareHtml = `
        <table>
          <tbody>
            <tr><th>Base</th><td>${money(fare.baseFare)}</td></tr>
            <tr><th>Zone</th><td>${money(fare.zoneCharge)}</td></tr>
            <tr><th>Discount</th><td>−${money(fare.discount)}</td></tr>
            <tr><th>Cap adjustment</th><td>${money(fare.capAdjustment)}</td></tr>
            <tr><th>Penalty</th><td>${money(fare.penalty)}</td></tr>
            <tr><th>Original</th><td>${money(fare.originalFare)}</td></tr>
            <tr><th>Final</th><td><strong>${money(fare.finalFare)}</strong></td></tr>
            <tr><th>Charge</th><td><span class="${statusClass(fare.charge?.status ?? '')}">${fare.charge?.status ?? '—'}</span> ${fare.charge ? money(fare.charge.amount) : ''}</td></tr>
          </tbody>
        </table>
      `;
    } catch {
      /* no fare */
    }

    if (!root) return;
    root.innerHTML = `
      <p><span class="${statusClass(journey.status)}">${journey.status}</span></p>
      <div class="panel stack">
        <div><strong>${journey.originStation.name}</strong> → <strong>${journey.destinationStation?.name ?? '—'}</strong></div>
        <div class="meta">Started ${formatWhen(journey.startedAt)}</div>
        <div class="meta">${journey.completedAt ? `Completed ${formatWhen(journey.completedAt)}` : 'In progress'}</div>
        <div class="mono meta">${journey.id}</div>
      </div>
      <h2>Fare breakdown</h2>
      <div class="panel">${fareHtml}</div>
      <p class="meta"><a href="/journeys.html">← All journeys</a></p>
    `;
  } catch (err) {
    showError(errEl, err);
  }
}

void load();
