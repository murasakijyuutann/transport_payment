package mjyuu.transport_payment.repository;


import mjyuu.transport_payment.entity.Station;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StationRepository extends JpaRepository<Station, Long> {
    
    Optional<Station> findByStationCode(String stationCode);
    
    List<Station> findByZoneNumber(Integer zoneNumber);
    
    @Query("SELECT s FROM Station s WHERE s.status = 'ACTIVE' ORDER BY s.name")
    List<Station> findAllActiveStations();
    
    boolean existsByStationCode(String stationCode);
    
    @Query("SELECT DISTINCT s.zoneNumber FROM Station s ORDER BY s.zoneNumber")
    List<Integer> findAllZones();
}