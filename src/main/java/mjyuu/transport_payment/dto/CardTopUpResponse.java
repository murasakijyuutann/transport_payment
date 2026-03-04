package mjyuu.transport_payment.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class CardTopUpResponse {
    private boolean success;
    private String message;
    private String transactionId;
    private BigDecimal amount;
    private BigDecimal newBalance;
    private String cardLastFour;       // e.g. "•••• 4242"
    private String cardType;           // VISA / MASTERCARD / AMEX / DEBIT
    private String paymentReference;   // e.g. "MOCK-A1B2C3D4"
    private LocalDateTime timestamp;
}
