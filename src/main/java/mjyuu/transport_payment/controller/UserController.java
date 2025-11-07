package mjyuu.transport_payment.controller;

import mjyuu.transport_payment.entity.User;
import mjyuu.transport_payment.service.TransactionService;
import mjyuu.transport_payment.service.UserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
public class UserController {

    private final UserService userService;
    private final TransactionService transactionService;

    /**
     * Get user profile
     * GET /api/users/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUserProfile(@PathVariable Long id) {
        log.info("REST API: Get user profile: {}", id);
        
        User user = userService.getUserById(id);
        UserDTO dto = convertToDTO(user);
        return ResponseEntity.ok(dto);
    }

    /**
     * Get user by email
     * GET /api/users/email?email=john@example.com
     */
    @GetMapping("/email")
    public ResponseEntity<UserDTO> getUserByEmail(@RequestParam String email) {
        log.info("REST API: Get user by email: {}", email);
        
        User user = userService.getUserByEmail(email);
        UserDTO dto = convertToDTO(user);
        return ResponseEntity.ok(dto);
    }

    /**
     * Update user profile
     * PUT /api/users/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<UserDTO> updateUser(@PathVariable Long id, 
                                              @Valid @RequestBody UserUpdateRequest request) {
        log.info("REST API: Update user: {}", id);
        
        User updatedUser = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .phoneNumber(request.getPhoneNumber())
                .build();
        
        User user = userService.updateUser(id, updatedUser);
        UserDTO dto = convertToDTO(user);
        
        return ResponseEntity.ok(dto);
    }

    /**
     * Top up user balance
     * POST /api/users/{id}/topup
     */
    @PostMapping("/{id}/topup")
    public ResponseEntity<TopUpResponse> topUpBalance(@PathVariable Long id, 
                                                      @Valid @RequestBody TopUpRequest request) {
        log.info("REST API: Top up balance for user: {}, amount: {}", id, request.getAmount());
        
        // Create transaction and update balance
        transactionService.createTopUpTransaction(id, request.getAmount());
        
        BigDecimal newBalance = userService.getUserBalance(id);
        
        TopUpResponse response = new TopUpResponse(
                true,
                "Balance topped up successfully",
                request.getAmount(),
                newBalance
        );
        
        return ResponseEntity.ok(response);
    }

    /**
     * Get user balance
     * GET /api/users/{id}/balance
     */
    @GetMapping("/{id}/balance")
    public ResponseEntity<BalanceResponse> getUserBalance(@PathVariable Long id) {
        log.info("REST API: Get balance for user: {}", id);
        
        BigDecimal balance = userService.getUserBalance(id);
        BalanceResponse response = new BalanceResponse(balance);
        
        return ResponseEntity.ok(response);
    }

    // Helper method to convert User entity to DTO
    private UserDTO convertToDTO(User user) {
        return new UserDTO(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhoneNumber(),
                user.getBalance(),
                user.getStatus().name(),
                user.getRole().name()
        );
    }

    // DTOs
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserDTO {
        private Long id;
        private String email;
        private String firstName;
        private String lastName;
        private String phoneNumber;
        private BigDecimal balance;
        private String status;
        private String role;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserRegistrationRequest {
        @jakarta.validation.constraints.NotBlank(message = "Email is required")
        @jakarta.validation.constraints.Email(message = "Invalid email format")
        private String email;
        
        @jakarta.validation.constraints.NotBlank(message = "Password is required")
        @jakarta.validation.constraints.Size(min = 8, message = "Password must be at least 8 characters")
        private String password;
        
        @jakarta.validation.constraints.NotBlank(message = "First name is required")
        private String firstName;
        
        @jakarta.validation.constraints.NotBlank(message = "Last name is required")
        private String lastName;
        
        @jakarta.validation.constraints.NotBlank(message = "Phone number is required")
        private String phoneNumber;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserUpdateRequest {
        private String firstName;
        private String lastName;
        private String phoneNumber;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopUpRequest {
        @NotNull(message = "Amount is required")
        @DecimalMin(value = "1.0", message = "Minimum top-up amount is £1.00")
        private BigDecimal amount;
    }

    @Data
    @AllArgsConstructor
    public static class TopUpResponse {
        private boolean success;
        private String message;
        private BigDecimal amountAdded;
        private BigDecimal newBalance;
    }

    @Data
    @AllArgsConstructor
    public static class BalanceResponse {
        private BigDecimal balance;
    }
}