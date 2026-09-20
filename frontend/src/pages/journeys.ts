import { getJourneyFare, listJourneys } from '../api';
import { requireAuth } from '../auth';
import { formatWhen, money, mountNav, showError, statusClass } from '../ui';

requireAuth();
mountNav('journeys');

const errEl = document.querySelector<HTMLElement>('#error');
const body = document.querySelector<HTMLElement>('#journeys-body');

async function load() {
  try {
    const journeys = await listJourneys();
    if (!body) return;
    if (journeys.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="meta">No journeys yet. <a href="/tap.html">Simulate a tap</a>.</td></tr>`;
      return;
    }

    const rows = await Promise.all(
      journeys.map(async (j) => {
        let fareLabel = '—';
        try {
          const fare = await getJourneyFare(j.id);
          fareLabel = money(fare.finalFare);
        } catch {
          /* OPEN journeys have no fare yet */
        }
        const dest = j.destinationStation
          ? `${j.destinationStation.name}`
          : '—';
        return `
          <tr>
            <td><span class="${statusClass(j.status)}">${j.status}</span></td>
            <td>${j.originStation.name}</td>
            <td>${dest}</td>
            <td>${formatWhen(j.startedAt)}</td>
            <td>${fareLabel}</td>
            <td><a href="/journey.html?id=${j.id}">Detail</a></td>
          </tr>
        `;
      }),
    );
    body.innerHTML = rows.join('');
  } catch (err) {
    showError(errEl, err);
  }
}

void load();
