package mjyuu.transport_payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardDTO {
    private Long id;
    private String cardNumber; // masked - e.g., "**** **** **** 1234"
    private String cardHolderName;
    private String cardType;
    private String expiryMonth;
    private String expiryYear;
    private String status;
    private boolean isDefault;
    private LocalDateTime createdAt;
}
