package mjyuu.transport_payment.service;

import mjyuu.transport_payment.dto.CardTopUpRequest;
import mjyuu.transport_payment.exception.PaymentProcessingException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * Simulates a payment gateway. Card data is validated in-memory only —
 * raw card numbers are never written to the database.
 */
@Service
@Slf4j
public class MockPaymentService {

    // These numbers always trigger a decline (mirrors Stripe's test card behaviour)
    private static final Set<String> DECLINE_NUMBERS = Set.of(
            "4000000000000002",  // generic decline
            "4000000000009995",  // insufficient funds
            "4000000000000069"   // expired card (decline-side)
    );

    public record PaymentResult(String paymentReference, String cardType, String lastFour) {}

    /**
     * Validates and processes a mock card payment.
     * Throws {@link PaymentProcessingException} if the card is declined or invalid.
     */
    public PaymentResult processPayment(CardTopUpRequest request) {
        String cardNumber = request.getCardNumber();

        validateLuhn(cardNumber);
        validateExpiry(request.getExpiryMonth(), request.getExpiryYear());
        validateCvvLength(cardNumber, request.getCvv());
        checkForDecline(cardNumber);

        String cardType = detectCardType(cardNumber);
        String lastFour = cardNumber.substring(cardNumber.length() - 4);
        String paymentReference = "MOCK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        log.info("Mock payment approved: type={}, last4={}, ref={}", cardType, lastFour, paymentReference);
        return new PaymentResult(paymentReference, cardType, lastFour);
    }

    // --- Luhn Algorithm ---

    private void validateLuhn(String cardNumber) {
        int sum = 0;
        boolean alternate = false;
        for (int i = cardNumber.length() - 1; i >= 0; i--) {
            int digit = Character.getNumericValue(cardNumber.charAt(i));
            if (alternate) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            alternate = !alternate;
        }
        if (sum % 10 != 0) {
            throw new PaymentProcessingException("Card declined: invalid card number");
        }
    }

    // --- Expiry Validation ---

    private void validateExpiry(String month, String year) {
        int expMonth = Integer.parseInt(month);
        int expYear = Integer.parseInt(year);
        if (expYear < 100) {
            expYear += 2000;  // treat 2-digit year as 20xx
        }

        LocalDate now = LocalDate.now();
        LocalDate expiry = LocalDate.of(expYear, expMonth, 1).plusMonths(1).minusDays(1);

        if (expiry.isBefore(now)) {
            throw new PaymentProcessingException("Card declined: card has expired");
        }
    }

    // --- CVV Length (Amex requires 4 digits, others 3) ---

    private void validateCvvLength(String cardNumber, String cvv) {
        boolean isAmex = cardNumber.startsWith("34") || cardNumber.startsWith("37");
        int expectedLength = isAmex ? 4 : 3;
        if (cvv.length() != expectedLength) {
            throw new PaymentProcessingException(
                    "Card declined: CVV must be " + expectedLength + " digits for this card type");
        }
    }

    // --- Mock Decline List ---

    private void checkForDecline(String cardNumber) {
        if (DECLINE_NUMBERS.contains(cardNumber)) {
            String reason = switch (cardNumber) {
                case "4000000000009995" -> "Card declined: insufficient funds";
                case "4000000000000069" -> "Card declined: card has expired";
                default -> "Card declined: do_not_honor";
            };
            throw new PaymentProcessingException(reason);
        }
    }

    // --- Card Type Detection ---

    private String detectCardType(String cardNumber) {
        if (cardNumber.startsWith("4")) return "VISA";
        if (cardNumber.startsWith("34") || cardNumber.startsWith("37")) return "AMEX";
        String prefix2 = cardNumber.length() >= 2 ? cardNumber.substring(0, 2) : "";
        int prefix2int = prefix2.isEmpty() ? 0 : Integer.parseInt(prefix2);
        if (prefix2int >= 51 && prefix2int <= 55) return "MASTERCARD";
        return "DEBIT";
    }
}
