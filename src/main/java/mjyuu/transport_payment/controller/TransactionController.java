package mjyuu.transport_payment.controller;

import mjyuu.transport_payment.entity.Transaction;
import mjyuu.transport_payment.service.TransactionService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
@Slf4j
public class TransactionController {

    private final TransactionService transactionService;

    /**
     * Get all transactions for a user
     * GET /api/transactions?userId=1
     */
    @GetMapping
    public ResponseEntity<List<TransactionDTO>> getUserTransactions(@RequestParam Long userId) {
        log.info("REST API: Get transactions for user: {}", userId);
        
        List<Transaction> transactions = transactionService.getUserTransactions(userId);
        List<TransactionDTO> dtos = transactions.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get transactions for a user within a date range
     * GET /api/transactions/range?userId=1&startDate=2024-01-01T00:00:00&endDate=2024-12-31T23:59:59
     */
    @GetMapping("/range")
    public ResponseEntity<List<TransactionDTO>> getUserTransactionsByDateRange(
            @RequestParam Long userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        
        log.info("REST API: Get transactions for user: {} from {} to {}", userId, startDate, endDate);
        
        List<Transaction> transactions = transactionService.getUserTransactionsByDateRange(
                userId, startDate, endDate);
        List<TransactionDTO> dtos = transactions.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get transaction by ID
     * GET /api/transactions/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<TransactionDTO> getTransactionById(@PathVariable Long id) {
        log.info("REST API: Get transaction: {}", id);
        
        Transaction transaction = transactionService.getTransactionById(id);
        TransactionDTO dto = convertToDTO(transaction);
        
        return ResponseEntity.ok(dto);
    }

    /**
     * Get daily spending for a user
     * GET /api/transactions/daily-spending?userId=1&date=2024-11-06T12:00:00
     */
    @GetMapping("/daily-spending")
    public ResponseEntity<DailySpendingResponse> getDailySpending(
            @RequestParam Long userId,
            @RequestParam(required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime date) {
        
        LocalDateTime targetDate = date != null ? date : LocalDateTime.now();
        log.info("REST API: Get daily spending for user: {} on date: {}", userId, targetDate);
        
        BigDecimal spending = transactionService.getDailySpending(userId, targetDate);
        DailySpendingResponse response = new DailySpendingResponse(
                userId,
                targetDate.toLocalDate(),
                spending
        );
        
        return ResponseEntity.ok(response);
    }

    // Helper method to convert Transaction entity to DTO
    private TransactionDTO convertToDTO(Transaction transaction) {
        return new TransactionDTO(
                transaction.getId(),
                transaction.getTransactionId(),
                transaction.getUser().getId(),
                transaction.getJourney() != null ? transaction.getJourney().getId() : null,
                transaction.getCard() != null ? transaction.getCard().getId() : null,
                transaction.getType().name(),
                transaction.getAmount(),
                transaction.getStatus().name(),
                transaction.getDescription(),
                transaction.getCreatedAt()
        );
    }

    // DTOs
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TransactionDTO {
        private Long id;
        private String transactionId;
        private Long userId;
        private Long journeyId;
        private Long cardId;
        private String type;
        private BigDecimal amount;
        private String status;
        private String description;
        private LocalDateTime createdAt;
    }

    @Data
    @AllArgsConstructor
    public static class DailySpendingResponse {
        private Long userId;
        private java.time.LocalDate date;
        private BigDecimal totalSpending;
    }
}
