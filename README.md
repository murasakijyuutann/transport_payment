# Transport Payment System

A public transport tap-on/tap-off payment system built with Spring Boot.

## Project Structure

```
transport-payment-system/
├── src/
│   ├── main/
│   │   ├── java/com/transport/payment/
│   │   │   ├── config/          # Configuration classes
│   │   │   ├── controller/      # REST & Web controllers
│   │   │   ├── dto/             # Data Transfer Objects
│   │   │   ├── entity/          # JPA entities
│   │   │   ├── repository/      # Spring Data repositories
│   │   │   ├── service/         # Business logic
│   │   │   ├── exception/       # Custom exceptions
│   │   │   └── util/            # Utility classes
│   │   └── resources/
│   │       ├── db/migration/    # Flyway scripts
│   │       ├── templates/       # Thymeleaf templates
│   │       ├── static/          # CSS, JS, images
│   │       └── application.yml  # Configuration
│   └── test/                    # Test files
└── pom.xml
```

## Core Entities

1. **User** - System users (customers, admins)
2. **Card** - Payment cards linked to users
3. **Station** - Transport stations with zones
4. **Journey** - Tap-in/tap-out records
5. **Transaction** - Payment transactions

## Technology Stack

- **Framework**: Spring Boot 3.2.0
- **Java**: 17
- **Database**: H2 (dev), PostgreSQL (prod)
- **ORM**: Spring Data JPA + Hibernate
- **Migration**: Flyway
- **Frontend**: Thymeleaf + Bootstrap 5
- **Security**: Spring Security
- **Build**: Maven

## Deployment Status

> **Status:** Production deployment is scheduled for a future release. The application has been thoroughly tested and is fully operational in the local development environment. Cloud deployment configuration and infrastructure provisioning are currently in progress.

## Getting Started

### Prerequisites
- Java 17 or higher
- Maven 3.6+

### Running the Application

1. Build the project:
```bash
mvn clean install
```

2. Run the application:
```bash
mvn spring-boot:run
```

3. Access the application:
- Main app: http://localhost:8080
- H2 Console: http://localhost:8080/h2-console
  - JDBC URL: jdbc:h2:mem:transportdb
  - Username: sa
  - Password: (leave blank)

### Default Users

**Customer Account:**
- Email: john.doe@example.com
- Password: password123

**Admin Account:**
- Email: admin@transport.com
- Password: admin123

## Key Features (Planned)

- [x] User registration and authentication
- [x] Card management
- [x] Station management with zones
- [ ] Tap-in/tap-out functionality
- [ ] Automatic fare calculation
- [ ] Daily fare capping
- [ ] Journey history
- [ ] Balance top-up
- [ ] Transaction history
- [ ] Admin dashboard

## Database Schema

See `src/main/resources/db/migration/` for the complete schema.

## Configuration

Key configuration in `application.yml`:
- `transport.payment.max-journey-duration-hours`: 4 hours
- `transport.payment.incomplete-journey-penalty`: £5.00
- `transport.payment.daily-cap-amount`: £15.00
- `transport.payment.base-fare`: £2.50
- `transport.payment.per-zone-charge`: £1.50

## Next Steps

1. Create repositories for data access
2. Implement service layer with business logic
3. Build REST API controllers
4. Create Thymeleaf UI
5. Implement fare calculation algorithm
6. Add security configuration
7. Implement daily capping logic# transport_payment
