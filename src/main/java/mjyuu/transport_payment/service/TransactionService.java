package mjyuu.transport_payment.service;

import mjyuu.transport_payment.entity.Transaction;
import mjyuu.transport_payment.entity.User;
import mjyuu.transport_payment.exception.ResourceNotFoundException;
import mjyuu.transport_payment.repository.TransactionRepository;
import mjyuu.transport_payment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<Transaction> getUserTransactions(Long userId) {
        return transactionRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public List<Transaction> getUserTransactionsByDateRange(Long userId, 
                                                            LocalDateTime startDate, 
                                                            LocalDateTime endDate) {
        return transactionRepository.findByUserIdAndDateRange(userId, startDate, endDate);
    }

    @Transactional(readOnly = true)
    public Transaction getTransactionById(Long id) {
        return transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public Transaction getTransactionByTransactionId(String transactionId) {
        return transactionRepository.findByTransactionId(transactionId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found: " + transactionId));
    }

    @Transactional(readOnly = true)
    public BigDecimal getDailySpending(Long userId, LocalDateTime date) {
        return transactionRepository.calculateDailySpending(userId, date);
    }

    @Transactional
    public Transaction createTopUpTransaction(Long userId, BigDecimal amount) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Create transaction
        Transaction transaction = Transaction.builder()
                .transactionId(UUID.randomUUID().toString())
                .user(user)
                .type(Transaction.TransactionType.TOP_UP)
                .amount(amount)
                .status(Transaction.TransactionStatus.COMPLETED)
                .description("Balance top-up")
                .build();

        transaction = transactionRepository.save(transaction);

        // Update user balance
        user.setBalance(user.getBalance().add(amount));
        userRepository.save(user);

        log.info("Top-up transaction created: id={}, user={}, amount={}", 
                 transaction.getId(), userId, amount);

        return transaction;
    }

    @Transactional
    public Transaction createRefundTransaction(Long journeyId, BigDecimal amount, String reason) {
        // This would be called when refunding a journey
        // Implementation would fetch the journey, user, etc.
        // For now, this is a placeholder
        log.info("Refund transaction requested for journey: {}, amount: {}", journeyId, amount);
        throw new UnsupportedOperationException("Refund functionality not yet implemented");
    }
}