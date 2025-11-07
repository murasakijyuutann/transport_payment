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
public class StationDTO {
    private Long id;
    private String name;
    private String stationCode;
    private Integer zoneNumber;
    private Double latitude;
    private Double longitude;
    private String status;
    private LocalDateTime createdAt;
}
