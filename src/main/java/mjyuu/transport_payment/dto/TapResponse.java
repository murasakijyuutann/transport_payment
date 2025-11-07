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
public class TapResponse {
    
    private boolean success;
    private String message;
    private Long journeyId;
    private String journeyStatus;
    private String stationName;
    private String stationCode;
    private LocalDateTime tapTime;
    private BigDecimal fareAmount;
    private BigDecimal currentBalance;
    private BigDecimal dailySpending;
    private boolean dailyCapReached;
    
    // For tap-out specifically
    private String entryStationName;
    private String exitStationName;
    private Integer zonesTransited;
    private Long journeyDurationMinutes;
}

