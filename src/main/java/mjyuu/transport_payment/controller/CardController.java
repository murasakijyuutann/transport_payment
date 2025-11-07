package mjyuu.transport_payment.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mjyuu.transport_payment.dto.ApiResponse;
import mjyuu.transport_payment.dto.CardDTO;
import mjyuu.transport_payment.dto.CardRequest;
import mjyuu.transport_payment.entity.Card;
import mjyuu.transport_payment.service.CardService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/cards")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Card Management", description = "APIs for managing user payment cards")
@SecurityRequirement(name = "Bearer Authentication")
public class CardController {

    private final CardService cardService;

    @Operation(summary = "Add a new card", description = "Register a new payment card for the user")
    @PostMapping("/user/{userId}")
    @PreAuthorize("@securityService.isOwnerOrAdmin(#userId)")
    public ResponseEntity<ApiResponse<CardDTO>> addCard(
            @PathVariable Long userId,
            @Valid @RequestBody CardRequest request) {
        log.info("REST API: Add card for user: {}", userId);

        Card card = Card.builder()
                .cardNumber(request.getCardNumber())
                .cardHolderName(request.getCardHolderName())
                .cardType(Card.CardType.valueOf(request.getCardType().toUpperCase()))
                .expiryMonth(request.getExpiryMonth())
                .expiryYear(request.getExpiryYear())
                .isDefault(request.isDefault())
                .build();

        Card savedCard = cardService.addCard(userId, card);
        CardDTO dto = convertToDTO(savedCard);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Card added successfully", dto));
    }

    @Operation(summary = "Get all cards for user", description = "Retrieve all payment cards for a specific user")
    @GetMapping("/user/{userId}")
    @PreAuthorize("@securityService.isOwnerOrAdmin(#userId)")
    public ResponseEntity<ApiResponse<List<CardDTO>>> getUserCards(@PathVariable Long userId) {
        log.info("REST API: Get cards for user: {}", userId);

        List<Card> cards = cardService.getUserCards(userId);
        List<CardDTO> dtos = cards.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(dtos));
    }

    @Operation(summary = "Get card by ID", description = "Retrieve a specific card by its ID")
    @GetMapping("/{cardId}")
    public ResponseEntity<ApiResponse<CardDTO>> getCard(@PathVariable Long cardId) {
        log.info("REST API: Get card: {}", cardId);

        Card card = cardService.getCardById(cardId);
        CardDTO dto = convertToDTO(card);

        return ResponseEntity.ok(ApiResponse.success(dto));
    }

    @Operation(summary = "Get default card", description = "Get the default payment card for a user")
    @GetMapping("/user/{userId}/default")
    @PreAuthorize("@securityService.isOwnerOrAdmin(#userId)")
    public ResponseEntity<ApiResponse<CardDTO>> getDefaultCard(@PathVariable Long userId) {
        log.info("REST API: Get default card for user: {}", userId);

        Card card = cardService.getDefaultCard(userId);
        CardDTO dto = convertToDTO(card);

        return ResponseEntity.ok(ApiResponse.success(dto));
    }

    @Operation(summary = "Set default card", description = "Set a card as the default payment method")
    @PutMapping("/{cardId}/set-default")
    public ResponseEntity<ApiResponse<CardDTO>> setDefaultCard(
            @PathVariable Long cardId,
            @RequestParam Long userId) {
        log.info("REST API: Set card {} as default for user: {}", cardId, userId);

        Card card = cardService.setDefaultCard(userId, cardId);
        CardDTO dto = convertToDTO(card);

        return ResponseEntity.ok(ApiResponse.success("Card set as default", dto));
    }

    @Operation(summary = "Block a card", description = "Block a card to prevent its use")
    @PutMapping("/{cardId}/block")
    public ResponseEntity<ApiResponse<CardDTO>> blockCard(@PathVariable Long cardId) {
        log.info("REST API: Block card: {}", cardId);

        Card card = cardService.blockCard(cardId);
        CardDTO dto = convertToDTO(card);

        return ResponseEntity.ok(ApiResponse.success("Card blocked successfully", dto));
    }

    @Operation(summary = "Delete a card", description = "Delete a card (soft delete by blocking)")
    @DeleteMapping("/{cardId}")
    public ResponseEntity<ApiResponse<Void>> deleteCard(
            @PathVariable Long cardId,
            @RequestParam Long userId) {
        log.info("REST API: Delete card {} for user: {}", cardId, userId);

        cardService.deleteCard(userId, cardId);

        return ResponseEntity.ok(ApiResponse.success("Card deleted successfully", null));
    }

    /**
     * Convert Card entity to DTO with masked card number
     */
    private CardDTO convertToDTO(Card card) {
        String maskedNumber = maskCardNumber(card.getCardNumber());

        return CardDTO.builder()
                .id(card.getId())
                .cardNumber(maskedNumber)
                .cardHolderName(card.getCardHolderName())
                .cardType(card.getCardType().name())
                .expiryMonth(card.getExpiryMonth())
                .expiryYear(card.getExpiryYear())
                .status(card.getStatus().name())
                .isDefault(card.isDefault())
                .createdAt(card.getCreatedAt())
                .build();
    }

    /**
     * Mask card number for security (show only last 4 digits)
     */
    private String maskCardNumber(String cardNumber) {
        if (cardNumber == null || cardNumber.length() < 4) {
            return "****";
        }
        String lastFour = cardNumber.substring(cardNumber.length() - 4);
        return "**** **** **** " + lastFour;
    }
}
