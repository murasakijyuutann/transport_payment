package mjyuu.transport_payment.repository;

import mjyuu.transport_payment.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    Optional<User> findByEmail(String email);
    
    boolean existsByEmail(String email);
    
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.cards WHERE u.id = ?1")
    Optional<User> findByIdWithCards(Long id);
    
    @Query("SELECT u FROM User u WHERE u.status = 'ACTIVE' AND u.balance >= ?1")
    java.util.List<User> findActiveUsersWithMinimumBalance(java.math.BigDecimal minimumBalance);
}