package mjyuu.transport_payment.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mjyuu.transport_payment.dto.JourneyDTO;
import mjyuu.transport_payment.dto.TapRequest;
import mjyuu.transport_payment.dto.TapResponse;
import mjyuu.transport_payment.entity.Card;
import mjyuu.transport_payment.entity.Journey;
import mjyuu.transport_payment.entity.Station;
import mjyuu.transport_payment.entity.Transaction;
import mjyuu.transport_payment.entity.User;
import mjyuu.transport_payment.exception.InsufficientBalanceException;
import mjyuu.transport_payment.exception.InvalidJourneyException;
import mjyuu.transport_payment.exception.ResourceNotFoundException;
import mjyuu.transport_payment.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class JourneyService {

    private final JourneyRepository journeyRepository;
    private final CardRepository cardRepository;
    private final StationRepository stationRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final FareCalculationService fareCalculationService;

    @Value("${transport.payment.max-journey-duration-hours}")
    private int maxJourneyDurationHours;

    /**
     * Handle tap-in (journey start)
     */
    @Transactional
    public TapResponse tapIn(TapRequest request) {
        log.info("Processing tap-in: card={}, station={}", request.getCardNumber(), request.getStationCode());

        // 1. Validate card
        Card card = cardRepository.findByCardNumber(request.getCardNumber())
                .orElseThrow(() -> new ResourceNotFoundException("Card not found: " + request.getCardNumber()));

        if (card.getStatus() != Card.CardStatus.ACTIVE) {
            throw new InvalidJourneyException("Card is not active");
        }

        // 2. Validate station
        Station station = stationRepository.findByStationCode(request.getStationCode())
                .orElseThrow(() -> new ResourceNotFoundException("Station not found: " + request.getStationCode()));

        if (station.getStatus() != Station.StationStatus.ACTIVE) {
            throw new InvalidJourneyException("Station is not operational");
        }

        // 3. Check for existing active journey
        journeyRepository.findActiveJourneyByCardId(card.getId())
                .ifPresent(existingJourney -> {
                    throw new InvalidJourneyException(
                            "Active journey already exists. Please tap out at: " + 
                            existingJourney.getEntryStation().getName());
                });

        // 4. Get user and check balance (minimum check)
        User user = card.getUser();
        if (user.getBalance().compareTo(BigDecimal.ZERO) <= 0) {
            throw new InsufficientBalanceException("Insufficient balance. Please top up your account.");
        }

        // 5. Create new journey
        LocalDateTime tapTime = request.getTapTime() != null ? request.getTapTime() : LocalDateTime.now();
        
        Journey journey = Journey.builder()
                .user(user)
                .card(card)
                .entryStation(station)
                .tapInTime(tapTime)
                .status(Journey.JourneyStatus.IN_PROGRESS)
                .build();

        journey = journeyRepository.save(journey);
        log.info("Journey created: id={}, user={}, station={}", 
                 journey.getId(), user.getEmail(), station.getName());

        return TapResponse.builder()
                .success(true)
                .message("Tap-in successful at " + station.getName())
                .journeyId(journey.getId())
                .journeyStatus(journey.getStatus().name())
                .stationName(station.getName())
                .stationCode(station.getStationCode())
                .tapTime(tapTime)
                .currentBalance(user.getBalance())
                .build();
    }

    /**
     * Handle tap-out (journey end)
     */
    @Transactional
    public TapResponse tapOut(TapRequest request) {
        log.info("Processing tap-out: card={}, station={}", request.getCardNumber(), request.getStationCode());

        // 1. Validate card
        Card card = cardRepository.findByCardNumber(request.getCardNumber())
                .orElseThrow(() -> new ResourceNotFoundException("Card not found: " + request.getCardNumber()));

        // 2. Find active journey
        Journey journey = journeyRepository.findActiveJourneyByCardId(card.getId())
                .orElseThrow(() -> new InvalidJourneyException("No active journey found. Please tap in first."));

        // 3. Validate exit station
        Station exitStation = stationRepository.findByStationCode(request.getStationCode())
                .orElseThrow(() -> new ResourceNotFoundException("Station not found: " + request.getStationCode()));

        // 4. Update journey with exit details
        LocalDateTime tapOutTime = request.getTapTime() != null ? request.getTapTime() : LocalDateTime.now();
        journey.setExitStation(exitStation);
        journey.setTapOutTime(tapOutTime);

        // 5. Calculate fare
        Station entryStation = journey.getEntryStation();
        int zonesTransited = fareCalculationService.calculateZonesTransited(entryStation, exitStation);
        BigDecimal baseFare = fareCalculationService.calculateFare(entryStation, exitStation);

        // 6. Apply daily capping
        BigDecimal currentDailySpending = transactionRepository.calculateDailySpending(
                journey.getUser().getId(), LocalDateTime.now());
        BigDecimal finalFare = fareCalculationService.applyDailyCapping(currentDailySpending, baseFare);
        BigDecimal discount = baseFare.subtract(finalFare);

        journey.setZonesTransited(zonesTransited);
        journey.setFareAmount(baseFare);
        journey.setDiscountAmount(discount);
        journey.setFinalAmount(finalFare);
        journey.setStatus(Journey.JourneyStatus.COMPLETED);

        // 7. Check user balance
        User user = journey.getUser();
        if (user.getBalance().compareTo(finalFare) < 0) {
            throw new InsufficientBalanceException(
                    String.format("Insufficient balance. Required: %.2f, Available: %.2f", 
                                  finalFare, user.getBalance()));
        }

        // 8. Deduct from user balance
        user.setBalance(user.getBalance().subtract(finalFare));
        userRepository.save(user);

        // 9. Create transaction record
        Transaction transaction = Transaction.builder()
                .transactionId(UUID.randomUUID().toString())
                .user(user)
                .journey(journey)
                .card(card)
                .type(Transaction.TransactionType.JOURNEY_PAYMENT)
                .amount(finalFare)
                .status(Transaction.TransactionStatus.COMPLETED)
                .description(String.format("Journey from %s to %s", 
                                          entryStation.getName(), exitStation.getName()))
                .build();
        transactionRepository.save(transaction);

        journeyRepository.save(journey);

        log.info("Journey completed: id={}, fare={}, zones={}, duration={} min", 
                 journey.getId(), finalFare, zonesTransited, journey.getDurationInMinutes());

        BigDecimal updatedDailySpending = currentDailySpending.add(finalFare);
        boolean capReached = updatedDailySpending.compareTo(fareCalculationService.getDailyCapAmount()) >= 0;

        return TapResponse.builder()
                .success(true)
                .message("Tap-out successful. Journey completed.")
                .journeyId(journey.getId())
                .journeyStatus(journey.getStatus().name())
                .entryStationName(entryStation.getName())
                .exitStationName(exitStation.getName())
                .stationName(exitStation.getName())
                .stationCode(exitStation.getStationCode())
                .tapTime(tapOutTime)
                .fareAmount(finalFare)
                .zonesTransited(zonesTransited)
                .journeyDurationMinutes(journey.getDurationInMinutes())
                .currentBalance(user.getBalance())
                .dailySpending(updatedDailySpending)
                .dailyCapReached(capReached)
                .build();
    }

    /**
     * Get journey history for a user
     */
    @Transactional(readOnly = true)
    public List<JourneyDTO> getUserJourneyHistory(Long userId) {
        return journeyRepository.findByUserId(userId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get active journey for a card
     */
    @Transactional(readOnly = true)
    public JourneyDTO getActiveJourney(String cardNumber) {
        Card card = cardRepository.findByCardNumber(cardNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Card not found"));

        return journeyRepository.findActiveJourneyByCardId(card.getId())
                .map(this::convertToDTO)
                .orElse(null);
    }

    /**
     * Process incomplete journeys (scheduled task would call this)
     */
    @Transactional
    public void processIncompleteJourneys() {
        LocalDateTime cutoffTime = LocalDateTime.now().minusHours(maxJourneyDurationHours);
        List<Journey> incompleteJourneys = journeyRepository.findIncompleteJourneysOlderThan(cutoffTime);

        log.info("Processing {} incomplete journeys", incompleteJourneys.size());

        for (Journey journey : incompleteJourneys) {
            journey.setStatus(Journey.JourneyStatus.INCOMPLETE);
            journey.setFareAmount(fareCalculationService.getIncompleteJourneyPenalty());
            journey.setFinalAmount(fareCalculationService.getIncompleteJourneyPenalty());

            // Deduct penalty from user balance
            User user = journey.getUser();
            user.setBalance(user.getBalance().subtract(journey.getFinalAmount()));
            userRepository.save(user);

            // Create penalty transaction
            Transaction transaction = Transaction.builder()
                    .transactionId(UUID.randomUUID().toString())
                    .user(user)
                    .journey(journey)
                    .card(journey.getCard())
                    .type(Transaction.TransactionType.PENALTY)
                    .amount(journey.getFinalAmount())
                    .status(Transaction.TransactionStatus.COMPLETED)
                    .description("Incomplete journey penalty")
                    .build();
            transactionRepository.save(transaction);

            journeyRepository.save(journey);
            log.info("Processed incomplete journey: id={}, penalty={}", journey.getId(), journey.getFinalAmount());
        }
    }

    private JourneyDTO convertToDTO(Journey journey) {
        return JourneyDTO.builder()
                .id(journey.getId())
                .userId(journey.getUser().getId())
                .userEmail(journey.getUser().getEmail())
                .cardNumber(journey.getCard().getCardNumber())
                .entryStationName(journey.getEntryStation().getName())
                .entryStationCode(journey.getEntryStation().getStationCode())
                .exitStationName(journey.getExitStation() != null ? journey.getExitStation().getName() : null)
                .exitStationCode(journey.getExitStation() != null ? journey.getExitStation().getStationCode() : null)
                .tapInTime(journey.getTapInTime())
                .tapOutTime(journey.getTapOutTime())
                .status(journey.getStatus().name())
                .fareAmount(journey.getFareAmount())
                .finalAmount(journey.getFinalAmount())
                .zonesTransited(journey.getZonesTransited())
                .durationMinutes(journey.getDurationInMinutes())
                .build();
    }
}