package mjyuu.transport_payment.repository;

import mjyuu.transport_payment.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    
    Optional<Transaction> findByTransactionId(String transactionId);
    
    List<Transaction> findByUserId(Long userId);
    
    @Query("SELECT t FROM Transaction t WHERE t.user.id = ?1 ORDER BY t.createdAt DESC")
    List<Transaction> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    @Query("SELECT t FROM Transaction t WHERE t.user.id = ?1 AND t.createdAt BETWEEN ?2 AND ?3 " +
           "ORDER BY t.createdAt DESC")
    List<Transaction> findByUserIdAndDateRange(Long userId, LocalDateTime startDate, LocalDateTime endDate);
    
    @Query("SELECT t FROM Transaction t WHERE t.journey.id = ?1")
    List<Transaction> findByJourneyId(Long journeyId);
    
    @Query("SELECT t FROM Transaction t WHERE t.type = ?1 AND t.status = ?2")
    List<Transaction> findByTypeAndStatus(Transaction.TransactionType type, Transaction.TransactionStatus status);
    
    // Calculate total spent on a specific day for daily capping
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t " +
           "WHERE t.user.id = ?1 AND t.type = 'JOURNEY_PAYMENT' " +
           "AND t.status = 'COMPLETED' AND DATE(t.createdAt) = DATE(?2)")
    java.math.BigDecimal calculateDailySpending(Long userId, LocalDateTime date);
}
