-- V2__seed_data.sql
-- Note: The DataInitializer.java also seeds stations and a demo user on startup.
-- This file seeds additional data for development convenience.

-- Sample stations (Zone-based system like London Underground)
INSERT INTO stations (station_code, name, zone_number, latitude, longitude, status, created_at, updated_at) VALUES
('ST001', 'Central Station', 1, 51.5074, -0.1278, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ST002', 'North Terminal', 1, 51.5155, -0.1415, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ST003', 'East Plaza', 2, 51.5225, -0.1011, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ST004', 'West End', 2, 51.5145, -0.1600, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ST005', 'South Bay', 3, 51.4900, -0.1300, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ST006', 'Airport Link', 4, 51.4700, -0.4543, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ST007', 'Riverside', 2, 51.5033, -0.1195, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ST008', 'Industrial Park', 3, 51.5400, -0.1000, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (station_code) DO NOTHING;

-- Test users (BCrypt hash of "password123")
INSERT INTO users (email, password, first_name, last_name, phone_number, balance, status, role, created_at, updated_at) VALUES
('john.doe@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'John', 'Doe', '+1234567890', 50.00, 'ACTIVE', 'CUSTOMER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('admin@transport.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Admin', 'User', '+1234567891', 0.00, 'ACTIVE', 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;

-- Test card for john.doe
INSERT INTO cards (card_number, card_holder_name, card_type, expiry_month, expiry_year, user_id, status, is_default, created_at, updated_at)
SELECT '****1234', 'John Doe', 'VISA', '12', '2028', id, 'ACTIVE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users WHERE email = 'john.doe@example.com'
ON CONFLICT (card_number) DO NOTHING;
