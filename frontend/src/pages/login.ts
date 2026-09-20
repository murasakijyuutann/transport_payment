import { ApiError, login } from '../api';
import { setSession } from '../auth';
import { clearError, showError } from '../ui';

const form = document.querySelector<HTMLFormElement>('#login-form');
const errEl = document.querySelector<HTMLElement>('#error');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(errEl);
  const data = new FormData(form);
  const email = String(data.get('email') ?? '');
  const password = String(data.get('password') ?? '');
  try {
    const result = await login(email, password);
    setSession(result);
    location.href = '/dashboard.html';
  } catch (err) {
    showError(errEl, err instanceof ApiError ? err : err);
  }
});
