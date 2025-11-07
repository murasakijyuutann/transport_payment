package mjyuu.transport_payment.service;

import  mjyuu.transport_payment.entity.Journey;
import  mjyuu.transport_payment.entity.Station;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
@Slf4j
public class FareCalculationService {

    @Value("${transport.payment.base-fare}")
    private BigDecimal baseFare;

    @Value("${transport.payment.per-zone-charge}")
    private BigDecimal perZoneCharge;

    @Value("${transport.payment.incomplete-journey-penalty}")
    private BigDecimal incompleteJourneyPenalty;

    @Value("${transport.payment.daily-cap-amount}")
    private BigDecimal dailyCapAmount;

    /**
     * Calculate fare for a journey based on zones transited
     */
    public BigDecimal calculateFare(Station entryStation, Station exitStation) {
        int zonesTransited = calculateZonesTransited(entryStation, exitStation);
        
        // Base fare + (zones × per-zone charge)
        BigDecimal zoneFare = perZoneCharge.multiply(BigDecimal.valueOf(zonesTransited));
        BigDecimal totalFare = baseFare.add(zoneFare);
        
        log.info("Calculated fare: {} for {} zones (entry: {}, exit: {})", 
                 totalFare, zonesTransited, entryStation.getName(), exitStation.getName());
        
        return totalFare.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Calculate zones transited between two stations
     */
    public int calculateZonesTransited(Station entryStation, Station exitStation) {
        // Calculate the number of zones crossed
        int entryZone = entryStation.getZoneNumber();
        int exitZone = exitStation.getZoneNumber();
        
        // Zones transited = absolute difference + 1
        // Example: Zone 1 to Zone 3 = |1-3| + 1 = 3 zones
        // Example: Zone 2 to Zone 2 = |2-2| + 1 = 1 zone
        int zonesTransited = Math.abs(entryZone - exitZone) + 1;
        
        log.debug("Zones transited: {} (from zone {} to zone {})", 
                  zonesTransited, entryZone, exitZone);
        
        return zonesTransited;
    }

    /**
     * Apply daily capping - return the amount that should actually be charged
     */
    public BigDecimal applyDailyCapping(BigDecimal currentDailySpending, BigDecimal newFare) {
        BigDecimal totalSpending = currentDailySpending.add(newFare);
        
        if (totalSpending.compareTo(dailyCapAmount) > 0) {
            // User has exceeded daily cap
            BigDecimal remainingAllowance = dailyCapAmount.subtract(currentDailySpending);
            
            if (remainingAllowance.compareTo(BigDecimal.ZERO) <= 0) {
                // Already at or over cap, this journey is free
                log.info("Daily cap reached. Journey is free. Cap: {}, Current spending: {}", 
                         dailyCapAmount, currentDailySpending);
                return BigDecimal.ZERO;
            }
            
            // Charge only the remaining amount to reach cap
            log.info("Daily cap applied. Original fare: {}, Charged: {}, Cap: {}", 
                     newFare, remainingAllowance, dailyCapAmount);
            return remainingAllowance.setScale(2, RoundingMode.HALF_UP);
        }
        
        // Under cap, charge full fare
        return newFare;
    }

    /**
     * Get penalty for incomplete journey
     */
    public BigDecimal getIncompleteJourneyPenalty() {
        return incompleteJourneyPenalty;
    }

    /**
     * Get daily cap amount
     */
    public BigDecimal getDailyCapAmount() {
        return dailyCapAmount;
    }

    /**
     * Calculate final amount after discounts
     */
    public BigDecimal calculateFinalAmount(BigDecimal fareAmount, BigDecimal discountAmount) {
        if (discountAmount == null) {
            discountAmount = BigDecimal.ZERO;
        }
        
        BigDecimal finalAmount = fareAmount.subtract(discountAmount);
        
        // Ensure non-negative
        if (finalAmount.compareTo(BigDecimal.ZERO) < 0) {
            finalAmount = BigDecimal.ZERO;
        }
        
        return finalAmount.setScale(2, RoundingMode.HALF_UP);
    }
}