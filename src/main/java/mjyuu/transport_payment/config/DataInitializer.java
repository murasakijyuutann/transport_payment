package mjyuu.transport_payment.config;

import mjyuu.transport_payment.entity.Station;
import mjyuu.transport_payment.entity.User;
import mjyuu.transport_payment.entity.User.UserRole;
import mjyuu.transport_payment.repository.StationRepository;
import mjyuu.transport_payment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final StationRepository stationRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        initializeStations();
        initializeDemoUser();
    }

    private void initializeStations() {
        if (stationRepository.count() > 0) {
            log.info("Stations already initialized");
            return;
        }

        log.info("Initializing stations...");

        // Zone 1 stations
        createStation("ST001", "Central Station", 1);
        createStation("ST002", "City Hall", 1);
        createStation("ST003", "Downtown", 1);
        
        // Zone 2 stations
        createStation("ST004", "Uptown", 2);
        createStation("ST005", "Midtown", 2);
        createStation("ST006", "West End", 2);
        
        // Zone 3 stations
        createStation("ST007", "Suburban North", 3);
        createStation("ST008", "Suburban South", 3);
        createStation("ST009", "Airport", 3);

        log.info("Stations initialized successfully");
    }

    private void createStation(String code, String name, Integer zone) {
        Station station = new Station();
        station.setStationCode(code);
        station.setName(name);
        station.setZoneNumber(zone);
        station.setLatitude(0.0);
        station.setLongitude(0.0);
        stationRepository.save(station);
    }

    private void initializeDemoUser() {
        if (userRepository.findByEmail("demo@example.com").isPresent()) {
            log.info("Demo user already exists");
            return;
        }

        log.info("Creating demo user...");

        User demoUser = new User();
        demoUser.setFirstName("Demo");
        demoUser.setLastName("User");
        demoUser.setEmail("demo@example.com");
        demoUser.setPhoneNumber("+1234567890");
        demoUser.setPassword(passwordEncoder.encode("demo123"));
        demoUser.setRole(UserRole.CUSTOMER);
        demoUser.setBalance(new BigDecimal("50.00"));
        
        userRepository.save(demoUser);

        log.info("Demo user created - Email: demo@example.com, Password: demo123");
    }
}
