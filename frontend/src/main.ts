import { fetchHealth } from './api';

const el = document.querySelector<HTMLParagraphElement>('#health');

async function showHealth() {
  if (!el) return;
  try {
    const data = await fetchHealth();
    el.textContent = `API status: ${data.status}`;
    el.dataset.state = 'ok';
  } catch {
    el.textContent = 'API status: unreachable (is the backend running on :3000?)';
    el.dataset.state = 'error';
  }
}

void showHealth();
