// Login page functionality

document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    if (isAuthenticated()) {
        window.location.href = '/dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        // Disable button and show loading
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Signing in...';

        try {
            const response = await AuthAPI.login(email, password);

            if (response.data && response.data.token) {
                // Store token and user data
                setToken(response.data.token);
                setUser(response.data.user);

                // Show success message
                showAlert('alert-container', 'Login successful! Redirecting...', 'success');

                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 1000);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            showAlert('alert-container', error.message || 'Login failed. Please check your credentials.', 'danger');
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Sign In';
        }
    });
});
