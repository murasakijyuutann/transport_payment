package mjyuu.transport_payment.controller;

import mjyuu.transport_payment.entity.Station;
import mjyuu.transport_payment.service.StationService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/stations")
@RequiredArgsConstructor
@Slf4j
public class StationController {

    private final StationService stationService;

    /**
     * Get all stations
     * GET /api/stations
     */
    @GetMapping
    public ResponseEntity<List<StationDTO>> getAllStations() {
        log.info("REST API: Get all stations");
        
        List<Station> stations = stationService.getAllActiveStations();
        List<StationDTO> dtos = stations.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get station by ID
     * GET /api/stations/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<StationDTO> getStationById(@PathVariable Long id) {
        log.info("REST API: Get station by id: {}", id);
        
        Station station = stationService.getStationById(id);
        StationDTO dto = convertToDTO(station);
        
        return ResponseEntity.ok(dto);
    }

    /**
     * Get station by code
     * GET /api/stations/code/{code}
     */
    @GetMapping("/code/{code}")
    public ResponseEntity<StationDTO> getStationByCode(@PathVariable String code) {
        log.info("REST API: Get station by code: {}", code);
        
        Station station = stationService.getStationByCode(code);
        StationDTO dto = convertToDTO(station);
        
        return ResponseEntity.ok(dto);
    }

    /**
     * Get stations by zone
     * GET /api/stations/zone/{zoneNumber}
     */
    @GetMapping("/zone/{zoneNumber}")
    public ResponseEntity<List<StationDTO>> getStationsByZone(@PathVariable Integer zoneNumber) {
        log.info("REST API: Get stations in zone: {}", zoneNumber);
        
        List<Station> stations = stationService.getStationsByZone(zoneNumber);
        List<StationDTO> dtos = stations.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get all zones
     * GET /api/stations/zones
     */
    @GetMapping("/zones")
    public ResponseEntity<List<Integer>> getAllZones() {
        log.info("REST API: Get all zones");
        
        List<Integer> zones = stationService.getAllZones();
        return ResponseEntity.ok(zones);
    }

    // Helper method to convert Station entity to DTO
    private StationDTO convertToDTO(Station station) {
        return new StationDTO(
                station.getId(),
                station.getStationCode(),
                station.getName(),
                station.getZoneNumber(),
                station.getLatitude(),
                station.getLongitude(),
                station.getStatus().name()
        );
    }

    // DTO
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StationDTO {
        private Long id;
        private String stationCode;
        private String name;
        private Integer zoneNumber;
        private Double latitude;
        private Double longitude;
        private String status;
    }
}