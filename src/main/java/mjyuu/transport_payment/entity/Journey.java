package mjyuu.transport_payment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "journeys")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class Journey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "entry_station_id", nullable = false)
    private Station entryStation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exit_station_id")
    private Station exitStation;

    @Column(nullable = false)
    private LocalDateTime tapInTime;

    private LocalDateTime tapOutTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private JourneyStatus status = JourneyStatus.IN_PROGRESS;

    @Column(precision = 10, scale = 2)
    private BigDecimal fareAmount;

    @Column(precision = 10, scale = 2)
    private BigDecimal discountAmount;

    @Column(precision = 10, scale = 2)
    private BigDecimal finalAmount;

    private Integer zonesTransited;

    @Column(length = 500)
    private String notes;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public enum JourneyStatus {
        IN_PROGRESS,    // Tapped in, not tapped out
        COMPLETED,      // Successfully completed
        INCOMPLETE,     // Tapped in but never tapped out (penalty)
        CANCELLED       // Cancelled/refunded
    }

    public Long getDurationInMinutes() {
        if (tapOutTime == null) {
            return null;
        }
        return java.time.Duration.between(tapInTime, tapOutTime).toMinutes();
    }
}