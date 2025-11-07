package mjyuu.transport_payment.repository;

import mjyuu.transport_payment.entity.Journey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface JourneyRepository extends JpaRepository<Journey, Long> {
    
    // Find active (in-progress) journey for a card - critical for tap-out
    @Query("SELECT j FROM Journey j WHERE j.card.id = ?1 AND j.status = 'IN_PROGRESS' ORDER BY j.tapInTime DESC")
    Optional<Journey> findActiveJourneyByCardId(Long cardId);
    
    // Find all journeys for a user
    @Query("SELECT j FROM Journey j WHERE j.user.id = ?1 ORDER BY j.tapInTime DESC")
    List<Journey> findByUserId(Long userId);
    
    // Find journeys within a date range for a user
    @Query("SELECT j FROM Journey j WHERE j.user.id = ?1 AND j.tapInTime BETWEEN ?2 AND ?3 ORDER BY j.tapInTime DESC")
    List<Journey> findByUserIdAndDateRange(Long userId, LocalDateTime startDate, LocalDateTime endDate);
    
    // Find all completed journeys for a user on a specific day (for daily capping)
    @Query("SELECT j FROM Journey j WHERE j.user.id = ?1 AND j.status = 'COMPLETED' " +
           "AND DATE(j.tapInTime) = DATE(?2) ORDER BY j.tapInTime")
    List<Journey> findCompletedJourneysByUserAndDate(Long userId, LocalDateTime date);
    
    // Find incomplete journeys older than specified hours
    @Query("SELECT j FROM Journey j WHERE j.status = 'IN_PROGRESS' " +
           "AND j.tapInTime < ?1")
    List<Journey> findIncompleteJourneysOlderThan(LocalDateTime dateTime);
    
    // Count active journeys for a card
    @Query("SELECT COUNT(j) FROM Journey j WHERE j.card.id = ?1 AND j.status = 'IN_PROGRESS'")
    long countActiveJourneysByCardId(Long cardId);
    
    // Get journey statistics for a user
    @Query("SELECT COUNT(j), SUM(j.finalAmount) FROM Journey j " +
           "WHERE j.user.id = ?1 AND j.status = 'COMPLETED' " +
           "AND j.tapInTime >= ?2")
    Object[] getUserJourneyStats(Long userId, LocalDateTime since);
}
