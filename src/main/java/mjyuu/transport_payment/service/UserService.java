package mjyuu.transport_payment.service;

import mjyuu.transport_payment.entity.User;
import mjyuu.transport_payment.exception.InsufficientBalanceException;
import mjyuu.transport_payment.exception.ResourceNotFoundException;
import mjyuu.transport_payment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Create a new user with encrypted password
     */
    public User createUser(User user) {
        log.info("Creating new user with email: {}", user.getEmail());
        
        // Check if email already exists
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new IllegalArgumentException("Email already exists: " + user.getEmail());
        }
        
        // Encrypt password
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        
        // Set default values
        if (user.getBalance() == null) {
            user.setBalance(BigDecimal.ZERO);
        }
        if (user.getStatus() == null) {
            user.setStatus(User.UserStatus.ACTIVE);
        }
        if (user.getRole() == null) {
            user.setRole(User.UserRole.CUSTOMER);
        }
        
        User savedUser = userRepository.save(user);
        log.info("User created successfully with ID: {}", savedUser.getId());
        
        return savedUser;
    }

    /**
     * Get user by ID
     */
    @Transactional(readOnly = true)
    public User getUserById(Long id) {
        log.debug("Fetching user with ID: {}", id);
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));
    }

    /**
     * Get user by email
     */
    @Transactional(readOnly = true)
    public User getUserByEmail(String email) {
        log.debug("Fetching user with email: {}", email);
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));
    }

    /**
     * Get all users (for admin)
     */
    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        log.debug("Fetching all users");
        return userRepository.findAll();
    }

    /**
     * Update user profile information
     */
    public User updateUser(Long id, User updatedUser) {
        log.info("Updating user with ID: {}", id);
        
        User existingUser = getUserById(id);
        
        // Update only allowed fields
        if (updatedUser.getFirstName() != null) {
            existingUser.setFirstName(updatedUser.getFirstName());
        }
        if (updatedUser.getLastName() != null) {
            existingUser.setLastName(updatedUser.getLastName());
        }
        if (updatedUser.getPhoneNumber() != null) {
            existingUser.setPhoneNumber(updatedUser.getPhoneNumber());
        }
        
        User savedUser = userRepository.save(existingUser);
        log.info("User updated successfully: {}", id);
        
        return savedUser;
    }

    /**
     * Update user status (for admin)
     */
    public User updateUserStatus(Long id, User.UserStatus status) {
        log.info("Updating user status to {} for ID: {}", status, id);
        
        User user = getUserById(id);
        user.setStatus(status);
        
        return userRepository.save(user);
    }

    /**
     * Delete user (soft delete by setting status to INACTIVE)
     */
    public void deleteUser(Long id) {
        log.info("Deleting user with ID: {}", id);
        
        User user = getUserById(id);
        user.setStatus(User.UserStatus.INACTIVE);
        userRepository.save(user);
        
        log.info("User deleted (set to INACTIVE): {}", id);
    }

    /**
     * Get user balance
     */
    @Transactional(readOnly = true)
    public BigDecimal getUserBalance(Long userId) {
        log.debug("Fetching balance for user: {}", userId);
        User user = getUserById(userId);
        return user.getBalance();
    }

    /**
     * Add funds to user balance
     */
    public BigDecimal addBalance(Long userId, BigDecimal amount) {
        log.info("Adding {} to balance for user: {}", amount, userId);
        
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }
        
        User user = getUserById(userId);
        BigDecimal newBalance = user.getBalance().add(amount);
        user.setBalance(newBalance);
        
        userRepository.save(user);
        log.info("New balance for user {}: {}", userId, newBalance);
        
        return newBalance;
    }

    /**
     * Deduct funds from user balance
     */
    public BigDecimal deductBalance(Long userId, BigDecimal amount) {
        log.info("Deducting {} from balance for user: {}", amount, userId);
        
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }
        
        User user = getUserById(userId);
        BigDecimal newBalance = user.getBalance().subtract(amount);
        
        if (newBalance.compareTo(BigDecimal.ZERO) < 0) {
            throw new InsufficientBalanceException(
                    "Insufficient balance. Current: " + user.getBalance() + ", Required: " + amount);
        }
        
        user.setBalance(newBalance);
        userRepository.save(user);
        
        log.info("New balance for user {}: {}", userId, newBalance);
        return newBalance;
    }

    /**
     * Check if user has sufficient balance
     */
    @Transactional(readOnly = true)
    public boolean hasSufficientBalance(Long userId, BigDecimal amount) {
        User user = getUserById(userId);
        return user.getBalance().compareTo(amount) >= 0;
    }

    /**
     * Change user password
     */
    public void changePassword(Long userId, String oldPassword, String newPassword) {
        log.info("Changing password for user: {}", userId);
        
        User user = getUserById(userId);
        
        // Verify old password
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        
        // Encrypt and set new password
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        
        log.info("Password changed successfully for user: {}", userId);
    }

    /**
     * Check if email exists
     */
    @Transactional(readOnly = true)
    public boolean emailExists(String email) {
        return userRepository.findByEmail(email).isPresent();
    }
}
