package mjyuu.transport_payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TransactionDTO {
    private Long id;
    private String transactionId;
    private String type;
    private BigDecimal amount;
    private String status;
    private String description;
    private Long userId;
    private Long cardId;
    private Long journeyId;
    private String paymentGatewayReference;
    private String failureReason;
    private LocalDateTime createdAt;
}
