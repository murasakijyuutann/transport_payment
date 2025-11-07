// Register page functionality

document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    if (isAuthenticated()) {
        window.location.href = '/dashboard.html';
        return;
    }

    const registerForm = document.getElementById('registerForm');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (password !== confirmPassword) {
            showAlert('alert-container', 'Passwords do not match!', 'danger');
            return;
        }

        if (password.length < 8) {
            showAlert('alert-container', 'Password must be at least 8 characters long!', 'danger');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Creating account...';

        try {
            const userData = {
                firstName,
                lastName,
                email,
                phoneNumber,
                password
            };

            const response = await AuthAPI.register(userData);

            if (response.data) {
                showAlert('alert-container', 
                    'Account created successfully! Redirecting to login...', 
                    'success'
                );

                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            }
        } catch (error) {
            showAlert('alert-container', 
                error.message || 'Registration failed. Please try again.', 
                'danger'
            );
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-user-plus me-2"></i>Create Account';
        }
    });
});
