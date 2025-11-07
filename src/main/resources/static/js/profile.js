// Profile page functionality

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const userId = getUserId();
    await loadProfile(userId);
    setupEventListeners();
});

async function loadProfile(userId) {
    try {
        const response = await UserAPI.getProfile(userId);
        const user = response.data;
        
        if (user) {
            // Update profile card
            document.getElementById('profileName').textContent = `${user.firstName} ${user.lastName}`;
            document.getElementById('profileEmail').textContent = user.email;
            document.getElementById('profilePhone').textContent = user.phoneNumber;
            document.getElementById('profileRole').textContent = user.role;
            
            // Format created date
            if (user.createdAt) {
                document.getElementById('memberSince').textContent = formatDate(user.createdAt);
            }
            
            // Fill form
            document.getElementById('firstName').value = user.firstName;
            document.getElementById('lastName').value = user.lastName;
            document.getElementById('email').value = user.email;
            document.getElementById('phoneNumber').value = user.phoneNumber;
        }
    } catch (error) {
        showAlert('alert-container', 'Failed to load profile: ' + error.message, 'danger');
    }
}

function setupEventListeners() {
    const userId = getUserId();
    
    // Update profile form
    const updateProfileForm = document.getElementById('updateProfileForm');
    updateProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userData = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phoneNumber: document.getElementById('phoneNumber').value.trim()
        };
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Updating...';
        
        try {
            const response = await UserAPI.updateProfile(userId, userData);
            
            if (response.data) {
                // Update stored user data
                setUser(response.data);
                
                showAlert('alert-container', 'Profile updated successfully!', 'success');
                
                // Update display
                document.getElementById('profileName').textContent = `${userData.firstName} ${userData.lastName}`;
                document.getElementById('profileEmail').textContent = userData.email;
                document.getElementById('profilePhone').textContent = userData.phoneNumber;
                
                // Update navbar
                const userNameElements = document.querySelectorAll('#userName');
                userNameElements.forEach(el => {
                    el.textContent = `${userData.firstName} ${userData.lastName}`;
                });
            }
        } catch (error) {
            showAlert('alert-container', 'Failed to update profile: ' + error.message, 'danger');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Profile';
        }
    });
    
    // Change password form
    const changePasswordForm = document.getElementById('changePasswordForm');
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        
        // Validation
        if (newPassword !== confirmNewPassword) {
            showAlert('alert-container', 'New passwords do not match!', 'danger');
            return;
        }
        
        if (newPassword.length < 8) {
            showAlert('alert-container', 'New password must be at least 8 characters long!', 'danger');
            return;
        }
        
        if (currentPassword === newPassword) {
            showAlert('alert-container', 'New password must be different from current password!', 'warning');
            return;
        }
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Changing...';
        
        try {
            await UserAPI.changePassword(userId, currentPassword, newPassword);
            
            showAlert('alert-container', 'Password changed successfully!', 'success');
            changePasswordForm.reset();
        } catch (error) {
            showAlert('alert-container', 'Failed to change password: ' + error.message, 'danger');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-key"></i> Change Password';
        }
    });
}
