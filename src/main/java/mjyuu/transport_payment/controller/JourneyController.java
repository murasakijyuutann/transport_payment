package mjyuu.transport_payment.controller;

import mjyuu.transport_payment.dto.ApiResponse;
import mjyuu.transport_payment.dto.JourneyDTO;
import mjyuu.transport_payment.dto.TapRequest;
import mjyuu.transport_payment.dto.TapResponse;
import mjyuu.transport_payment.service.JourneyService;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
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

    @PostMapping("/tap-in")
    public ResponseEntity<ApiResponse<TapResponse>> tapIn(@Valid @RequestBody TapRequest request) {
        log.info("REST API: Tap-in request for card: {}, station: {}",
                 request.getCardNumber(), request.getStationCode());
        TapResponse response = journeyService.tapIn(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Tap-in successful", response));
    }

    @PostMapping("/tap-out")
    public ResponseEntity<ApiResponse<TapResponse>> tapOut(@Valid @RequestBody TapRequest request) {
        log.info("REST API: Tap-out request for card: {}, station: {}",
                 request.getCardNumber(), request.getStationCode());
        TapResponse response = journeyService.tapOut(request);
        return ResponseEntity.ok(ApiResponse.success("Tap-out successful", response));
    }

    @PostMapping("/tap-in-by-id")
    public ResponseEntity<ApiResponse<TapResponse>> tapInById(@RequestBody TapByIdRequest request) {
        log.info("REST API: Tap-in by id: cardId={}, stationId={}",
                 request.getCardId(), request.getStationId());
        TapResponse response = journeyService.tapInByCardId(request.getCardId(), request.getStationId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Tap-in successful", response));
    }

    @PostMapping("/tap-out-by-id")
    public ResponseEntity<ApiResponse<TapResponse>> tapOutById(@RequestBody TapOutByIdRequest request) {
        log.info("REST API: Tap-out by id: journeyId={}, exitStationId={}",
                 request.getJourneyId(), request.getExitStationId());
        TapResponse response = journeyService.tapOutByJourneyId(request.getJourneyId(), request.getExitStationId());
        return ResponseEntity.ok(ApiResponse.success("Tap-out successful", response));
    }

    @GetMapping("/history")
    public ResponseEntity<ApiResponse<List<JourneyDTO>>> getJourneyHistory(@RequestParam Long userId) {
        log.info("REST API: Get journey history for user: {}", userId);
        List<JourneyDTO> journeys = journeyService.getUserJourneyHistory(userId);
        return ResponseEntity.ok(ApiResponse.success(journeys));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<JourneyDTO>> getActiveJourney(@RequestParam String cardNumber) {
        log.info("REST API: Get active journey for card: {}", cardNumber);
        JourneyDTO journey = journeyService.getActiveJourney(cardNumber);
        return ResponseEntity.ok(ApiResponse.success(journey));
    }

    @PostMapping("/process-incomplete")
    public ResponseEntity<ApiResponse<String>> processIncompleteJourneys() {
        log.info("REST API: Processing incomplete journeys");
        journeyService.processIncompleteJourneys();
        return ResponseEntity.ok(ApiResponse.success("Incomplete journeys processed successfully", "OK"));
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TapByIdRequest {
        private Long cardId;
        private Long stationId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TapOutByIdRequest {
        private Long journeyId;
        private Long exitStationId;
    }
}
