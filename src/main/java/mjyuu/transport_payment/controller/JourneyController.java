package mjyuu.transport_payment.controller;

import mjyuu.transport_payment.dto.JourneyDTO;
import mjyuu.transport_payment.dto.TapRequest;
import mjyuu.transport_payment.dto.TapResponse;
import mjyuu.transport_payment.service.JourneyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/journeys")
@RequiredArgsConstructor
@Slf4j
public class JourneyController {

    private final JourneyService journeyService;

    /**
     * Tap in at a station to start a journey
     * POST /api/journeys/tap-in
     */
    @PostMapping("/tap-in")
    public ResponseEntity<TapResponse> tapIn(@Valid @RequestBody TapRequest request) {
        log.info("REST API: Tap-in request for card: {}, station: {}", 
                 request.getCardNumber(), request.getStationCode());
        
        TapResponse response = journeyService.tapIn(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Tap out at a station to end a journey
     * POST /api/journeys/tap-out
     */
    @PostMapping("/tap-out")
    public ResponseEntity<TapResponse> tapOut(@Valid @RequestBody TapRequest request) {
        log.info("REST API: Tap-out request for card: {}, station: {}", 
                 request.getCardNumber(), request.getStationCode());
        
        TapResponse response = journeyService.tapOut(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Get journey history for a user
     * GET /api/journeys/history?userId=1
     */
    @GetMapping("/history")
    public ResponseEntity<List<JourneyDTO>> getJourneyHistory(@RequestParam Long userId) {
        log.info("REST API: Get journey history for user: {}", userId);
        
        List<JourneyDTO> journeys = journeyService.getUserJourneyHistory(userId);
        return ResponseEntity.ok(journeys);
    }

    /**
     * Get active journey for a card
     * GET /api/journeys/active?cardNumber=****1234
     */
    @GetMapping("/active")
    public ResponseEntity<JourneyDTO> getActiveJourney(@RequestParam String cardNumber) {
        log.info("REST API: Get active journey for card: {}", cardNumber);
        
        JourneyDTO journey = journeyService.getActiveJourney(cardNumber);
        
        if (journey == null) {
            return ResponseEntity.noContent().build();
        }
        
        return ResponseEntity.ok(journey);
    }

    /**
     * Manually process incomplete journeys (admin endpoint)
     * POST /api/journeys/process-incomplete
     */
    @PostMapping("/process-incomplete")
    public ResponseEntity<String> processIncompleteJourneys() {
        log.info("REST API: Processing incomplete journeys");
        
        journeyService.processIncompleteJourneys();
        return ResponseEntity.ok("Incomplete journeys processed successfully");
    }
}
