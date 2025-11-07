package mjyuu.transport_payment.service;

import mjyuu.transport_payment.entity.Card;
import mjyuu.transport_payment.entity.User;
import mjyuu.transport_payment.exception.ResourceNotFoundException;
import mjyuu.transport_payment.repository.CardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.YearMonth;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CardService {

    private final CardRepository cardRepository;
    private final UserService userService;

    /**
     * Add a new card for a user
     */
    public Card addCard(Long userId, Card card) {
        log.info("Adding new card for user: {}", userId);
        
        User user = userService.getUserById(userId);
        card.setUser(user);
        
        // Validate card expiry
        validateCardExpiry(card.getExpiryMonth(), card.getExpiryYear());
        
        // Set default values
        if (card.getStatus() == null) {
            card.setStatus(Card.CardStatus.ACTIVE);
        }
        
        // If this is the first card or explicitly set as default, make it default
        List<Card> existingCards = cardRepository.findByUserId(userId);
        if (existingCards.isEmpty() || card.isDefault()) {
            // Unset other default cards
            if (card.isDefault()) {
                existingCards.forEach(c -> {
                    c.setDefault(false);
                    cardRepository.save(c);
                });
            } else {
                card.setDefault(true);
            }
        }
        
        Card savedCard = cardRepository.save(card);
        log.info("Card added successfully with ID: {}", savedCard.getId());
        
        return savedCard;
    }

    /**
     * Get card by ID
     */
    @Transactional(readOnly = true)
    public Card getCardById(Long cardId) {
        log.debug("Fetching card with ID: {}", cardId);
        return cardRepository.findById(cardId)
                .orElseThrow(() -> new ResourceNotFoundException("Card not found with ID: " + cardId));
    }

    /**
     * Get card by card number
     */
    @Transactional(readOnly = true)
    public Card getCardByNumber(String cardNumber) {
        log.debug("Fetching card with number: ****{}", cardNumber.substring(Math.max(0, cardNumber.length() - 4)));
        return cardRepository.findByCardNumber(cardNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Card not found with number: " + cardNumber));
    }

    /**
     * Get all cards for a user
     */
    @Transactional(readOnly = true)
    public List<Card> getUserCards(Long userId) {
        log.debug("Fetching cards for user: {}", userId);
        return cardRepository.findByUserId(userId);
    }

    /**
     * Get user's default card
     */
    @Transactional(readOnly = true)
    public Card getDefaultCard(Long userId) {
        log.debug("Fetching default card for user: {}", userId);
        return cardRepository.findByUserIdAndIsDefault(userId, true)
                .orElseThrow(() -> new ResourceNotFoundException("No default card found for user: " + userId));
    }

    /**
     * Set a card as default
     */
    public Card setDefaultCard(Long userId, Long cardId) {
        log.info("Setting card {} as default for user: {}", cardId, userId);
        
        Card card = getCardById(cardId);
        
        // Verify card belongs to user
        if (!card.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Card does not belong to user");
        }
        
        // Unset other default cards
        List<Card> userCards = cardRepository.findByUserId(userId);
        userCards.forEach(c -> {
            if (c.isDefault() && !c.getId().equals(cardId)) {
                c.setDefault(false);
                cardRepository.save(c);
            }
        });
        
        card.setDefault(true);
        Card savedCard = cardRepository.save(card);
        
        log.info("Default card set successfully: {}", cardId);
        return savedCard;
    }

    /**
     * Update card status
     */
    public Card updateCardStatus(Long cardId, Card.CardStatus status) {
        log.info("Updating card {} status to: {}", cardId, status);
        
        Card card = getCardById(cardId);
        card.setStatus(status);
        
        return cardRepository.save(card);
    }

    /**
     * Block a card
     */
    public Card blockCard(Long cardId) {
        log.info("Blocking card: {}", cardId);
        return updateCardStatus(cardId, Card.CardStatus.BLOCKED);
    }

    /**
     * Delete a card (soft delete by blocking)
     */
    public void deleteCard(Long userId, Long cardId) {
        log.info("Deleting card {} for user: {}", cardId, userId);
        
        Card card = getCardById(cardId);
        
        // Verify card belongs to user
        if (!card.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Card does not belong to user");
        }
        
        // Block the card instead of deleting
        card.setStatus(Card.CardStatus.BLOCKED);
        cardRepository.save(card);
        
        // If this was the default card, set another card as default
        if (card.isDefault()) {
            List<Card> activeCards = cardRepository.findByUserIdAndStatus(userId, Card.CardStatus.ACTIVE);
            if (!activeCards.isEmpty()) {
                Card newDefaultCard = activeCards.get(0);
                newDefaultCard.setDefault(true);
                cardRepository.save(newDefaultCard);
                log.info("Set card {} as new default", newDefaultCard.getId());
            }
        }
        
        log.info("Card deleted (blocked): {}", cardId);
    }

    /**
     * Validate card expiry date
     */
    private void validateCardExpiry(String expiryMonth, String expiryYear) {
        try {
            int month = Integer.parseInt(expiryMonth);
            int year = Integer.parseInt(expiryYear);
            
            if (month < 1 || month > 12) {
                throw new IllegalArgumentException("Invalid expiry month");
            }
            
            // Convert 2-digit year to 4-digit
            if (year < 100) {
                year += 2000;
            }
            
            YearMonth cardExpiry = YearMonth.of(year, month);
            YearMonth now = YearMonth.now();
            
            if (cardExpiry.isBefore(now)) {
                throw new IllegalArgumentException("Card has expired");
            }
            
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid expiry date format");
        }
    }

    /**
     * Check if card is valid for use
     */
    @Transactional(readOnly = true)
    public boolean isCardValid(Long cardId) {
        Card card = getCardById(cardId);
        
        // Check status
        if (card.getStatus() != Card.CardStatus.ACTIVE) {
            return false;
        }
        
        // Check expiry
        try {
            validateCardExpiry(card.getExpiryMonth(), card.getExpiryYear());
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
