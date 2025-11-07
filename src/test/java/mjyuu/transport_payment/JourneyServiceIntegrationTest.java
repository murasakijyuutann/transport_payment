package mjyuu.transport_payment;


import mjyuu.transport_payment.dto.TapRequest;
import mjyuu.transport_payment.dto.TapResponse;
import mjyuu.transport_payment.entity.Card;
import mjyuu.transport_payment.entity.Station;
import mjyuu.transport_payment.entity.User;
import mjyuu.transport_payment.repository.CardRepository;
import mjyuu.transport_payment.repository.StationRepository;
import mjyuu.transport_payment.repository.UserRepository;
import mjyuu.transport_payment.service.JourneyService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class JourneyServiceIntegrationTest {

    @Autowired
    private JourneyService journeyService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private StationRepository stationRepository;

    @Test
    void testCompleteTapInTapOutJourney() {
        // Given: User with card exists (from seed data)
        User user = userRepository.findByEmail("john.doe@example.com").orElseThrow();
        Card card = cardRepository.findByUserId(user.getId()).get(0);
        
        // When: Tap in at Central Station
        TapRequest tapInRequest = TapRequest.builder()
                .cardNumber(card.getCardNumber())
                .stationCode("ST001")
                .build();
        
        TapResponse tapInResponse = journeyService.tapIn(tapInRequest);
        
        // Then: Tap in should be successful
        assertTrue(tapInResponse.isSuccess());
        assertEquals("IN_PROGRESS", tapInResponse.getJourneyStatus());
        assertEquals("Central Station", tapInResponse.getStationName());
        assertNotNull(tapInResponse.getJourneyId());
        
        // When: Tap out at East Plaza (Zone 2)
        TapRequest tapOutRequest = TapRequest.builder()
                .cardNumber(card.getCardNumber())
                .stationCode("ST003")
                .build();
        
        TapResponse tapOutResponse = journeyService.tapOut(tapOutRequest);
        
        // Then: Tap out should be successful with fare calculated
        assertTrue(tapOutResponse.isSuccess());
        assertEquals("COMPLETED", tapOutResponse.getJourneyStatus());
        assertEquals("Central Station", tapOutResponse.getEntryStationName());
        assertEquals("East Plaza", tapOutResponse.getExitStationName());
        assertNotNull(tapOutResponse.getFareAmount());
        assertEquals(2, tapOutResponse.getZonesTransited());
        
        // Verify fare calculation: base (2.50) + 2 zones * 1.50 = 5.50
        assertEquals(new BigDecimal("5.50"), tapOutResponse.getFareAmount());
        
        System.out.println("✅ Test passed! Journey completed successfully.");
        System.out.println("Entry: " + tapOutResponse.getEntryStationName());
        System.out.println("Exit: " + tapOutResponse.getExitStationName());
        System.out.println("Zones: " + tapOutResponse.getZonesTransited());
        System.out.println("Fare: £" + tapOutResponse.getFareAmount());
        System.out.println("Remaining Balance: £" + tapOutResponse.getCurrentBalance());
    }
}