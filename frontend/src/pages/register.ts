import { ApiError, register } from '../api';
import { setSession } from '../auth';
import { clearError, showError } from '../ui';

const form = document.querySelector<HTMLFormElement>('#register-form');
const errEl = document.querySelector<HTMLElement>('#error');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(errEl);
  const data = new FormData(form);
  try {
    const result = await register({
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      firstName: String(data.get('firstName') ?? ''),
      lastName: String(data.get('lastName') ?? ''),
    });
    setSession(result);
    location.href = '/dashboard.html';
  } catch (err) {
    showError(errEl, err instanceof ApiError ? err : err);
  }
});
