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
public class JourneyDTO {
    
    private Long id;
    private Long userId;
    private String userEmail;
    private String cardNumber;
    private String entryStationName;
    private String entryStationCode;
    private String exitStationName;
    private String exitStationCode;
    private LocalDateTime tapInTime;
    private LocalDateTime tapOutTime;
    private String status;
    private BigDecimal fareAmount;
    private BigDecimal finalAmount;
    private Integer zonesTransited;
    private Long durationMinutes;
}
