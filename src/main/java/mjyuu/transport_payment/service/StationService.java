package mjyuu.transport_payment.service;


import mjyuu.transport_payment.entity.Station;
import mjyuu.transport_payment.exception.ResourceNotFoundException;
import mjyuu.transport_payment.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class StationService {

    private final StationRepository stationRepository;

    @Transactional(readOnly = true)
    public List<Station> getAllStations() {
        return stationRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Station> getAllActiveStations() {
        return stationRepository.findAllActiveStations();
    }

    @Transactional(readOnly = true)
    public Station getStationById(Long id) {
        return stationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Station not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public Station getStationByCode(String stationCode) {
        return stationRepository.findByStationCode(stationCode)
                .orElseThrow(() -> new ResourceNotFoundException("Station not found with code: " + stationCode));
    }

    @Transactional(readOnly = true)
    public List<Station> getStationsByZone(Integer zoneNumber) {
        return stationRepository.findByZoneNumber(zoneNumber);
    }

    @Transactional(readOnly = true)
    public List<Integer> getAllZones() {
        return stationRepository.findAllZones();
    }

    @Transactional
    public Station createStation(Station station) {
        if (stationRepository.existsByStationCode(station.getStationCode())) {
            throw new IllegalArgumentException("Station already exists with code: " + station.getStationCode());
        }
        
        if (station.getStatus() == null) {
            station.setStatus(Station.StationStatus.ACTIVE);
        }
        
        station = stationRepository.save(station);
        log.info("Station created: id={}, code={}, name={}", 
                 station.getId(), station.getStationCode(), station.getName());
        return station;
    }

    @Transactional
    public Station updateStation(Long id, Station updatedStation) {
        Station station = getStationById(id);
        
        if (updatedStation.getName() != null) {
            station.setName(updatedStation.getName());
        }
        if (updatedStation.getZoneNumber() != null) {
            station.setZoneNumber(updatedStation.getZoneNumber());
        }
        if (updatedStation.getStatus() != null) {
            station.setStatus(updatedStation.getStatus());
        }
        
        station = stationRepository.save(station);
        log.info("Station updated: id={}", id);
        return station;
    }
}