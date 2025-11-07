package mjyuu.transport_payment.repository;

import mjyuu.transport_payment.entity.Card;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CardRepository extends JpaRepository<Card, Long> {
    
    List<Card> findByUserId(Long userId);
    
    Optional<Card> findByCardNumber(String cardNumber);
    
    boolean existsByCardNumber(String cardNumber);
    
    Optional<Card> findByUserIdAndIsDefault(Long userId, boolean isDefault);
    
    List<Card> findByUserIdAndStatus(Long userId, Card.CardStatus status);
    
    @Query("SELECT c FROM Card c WHERE c.user.id = ?1 AND c.isDefault = true")
    Optional<Card> findDefaultCardByUserId(Long userId);
    
    @Query("SELECT c FROM Card c WHERE c.user.id = ?1 AND c.status = 'ACTIVE'")
    List<Card> findActiveCardsByUserId(Long userId);
    
    Optional<Card> findByIdAndUserId(Long cardId, Long userId);
}