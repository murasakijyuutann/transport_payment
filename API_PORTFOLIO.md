# Transport Payment System - Backend API

A comprehensive Spring Boot RESTful API for a public transport tap-on/tap-off payment system, similar to Oyster Card or Suica systems.

## 🚀 Project Overview

This is a production-ready backend application showcasing modern Spring Boot development practices, suitable for portfolio demonstration and technical interviews.

### Key Features

✅ **User Management**
- User registration and authentication
- Profile management
- Balance management (top-up, deductions)
- Role-based access control (Customer, Admin, Operator)

✅ **Card Management**
- Multiple payment cards per user
- Card validation and security
- Default card selection
- Card blocking and management

✅ **Journey Tracking**
- Tap-in/Tap-out functionality
- Real-time journey tracking
- Incomplete journey handling
- Journey history

✅ **Fare Calculation**
- Zone-based pricing
- Dynamic fare calculation
- Daily fare capping
- Penalty for incomplete journeys

✅ **Transaction Management**
- Payment processing
- Transaction history
- Refund handling
- Audit trail

✅ **Station Management**
- Station CRUD operations
- Zone configuration
- Geo-location support

## 🛠️ Technology Stack

- **Framework**: Spring Boot 3.4.0
- **Language**: Java 21
- **Database**: PostgreSQL (production) / H2 (development)
- **Security**: Spring Security + JWT authentication
- **ORM**: Spring Data JPA + Hibernate
- **Caching**: Redis (optional)
- **Documentation**: SpringDoc OpenAPI 3 (Swagger)
- **Build Tool**: Maven
- **Testing**: JUnit 5, MockMvc

## 📋 Architecture Highlights

### Layered Architecture
```
├── Controller Layer (REST endpoints)
├── Service Layer (Business logic)
├── Repository Layer (Data access)
├── Entity Layer (Domain models)
├── DTO Layer (Data transfer objects)
├── Security Layer (JWT, authentication)
└── Configuration Layer (App config, security, OpenAPI)
```

### Design Patterns Used
- **Repository Pattern** - Data access abstraction
- **Service Layer Pattern** - Business logic encapsulation
- **DTO Pattern** - Decoupling API from domain model
- **Builder Pattern** - Clean object construction (Lombok)
- **Dependency Injection** - Loose coupling via Spring IoC
- **Exception Handler Pattern** - Centralized error handling

### Security Features
- JWT token-based authentication
- BCrypt password encoding
- Role-based authorization (`@PreAuthorize`)
- CORS configuration
- SQL injection prevention (JPA)

### Database Design
- **Normalized schema** with proper foreign keys
- **Audit fields** (createdAt, updatedAt) on all entities
- **Soft delete** pattern (status fields instead of hard delete)
- **Optimized queries** with proper indexing
- **Transaction management** with `@Transactional`

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login (returns JWT)

### Users
- `GET /api/users/{id}` - Get user profile
- `PUT /api/users/{id}` - Update user profile
- `POST /api/users/{id}/topup` - Top up balance
- `GET /api/users/{id}/balance` - Get current balance

### Cards
- `POST /api/cards/user/{userId}` - Add new card
- `GET /api/cards/user/{userId}` - Get all user cards
- `GET /api/cards/{cardId}` - Get card details
- `PUT /api/cards/{cardId}/set-default` - Set default card
- `PUT /api/cards/{cardId}/block` - Block a card
- `DELETE /api/cards/{cardId}` - Delete card

### Journeys
- `POST /api/journeys/tap-in` - Start journey
- `POST /api/journeys/tap-out` - End journey
- `GET /api/journeys/user/{userId}` - Get journey history
- `GET /api/journeys/{id}` - Get journey details

### Stations
- `GET /api/stations` - List all stations
- `GET /api/stations/{id}` - Get station details
- `POST /api/stations` - Create station (Admin only)
- `PUT /api/stations/{id}` - Update station (Admin only)

### Transactions
- `GET /api/transactions/user/{userId}` - Get transaction history
- `GET /api/transactions/{id}` - Get transaction details

## 📊 API Documentation

Interactive API documentation available at:
- **Swagger UI**: http://localhost:8080/swagger-ui.html
- **OpenAPI Spec**: http://localhost:8080/v3/api-docs

## 🚦 Getting Started

### Prerequisites
- Java 21
- Maven 3.8+
- PostgreSQL 14+ (or use H2 for development)

### Running the Application

```bash
# Clone the repository
git clone https://github.com/yourusername/transport-payment.git
cd transport-payment

# Run with Maven
./mvnw spring-boot:run

# Or build and run JAR
./mvnw clean package
java -jar target/payment-system-1.0.0.jar
```

### Configuration

Key configurations in `application.yml`:
```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:h2:mem:transportdb  # Change to PostgreSQL in production
  
jwt:
  secret: your-secret-key
  expiration: 86400000  # 24 hours

transport:
  payment:
    max-journey-duration-hours: 4
    incomplete-journey-penalty: 5.00
    daily-cap-amount: 15.00
```

## 🧪 Testing

```bash
# Run all tests
./mvnw test

# Run with coverage
./mvnw test jacoco:report
```

## 💡 Interview Talking Points

1. **Scalability**: Stateless JWT authentication, caching with Redis, database indexing
2. **Security**: JWT, BCrypt, SQL injection prevention, role-based access
3. **Clean Code**: SOLID principles, DRY, proper layering, meaningful naming
4. **Error Handling**: Global exception handler, custom exceptions, proper HTTP status codes
5. **Documentation**: OpenAPI/Swagger, code comments, README
6. **Best Practices**: DTOs for API, validation, transaction management, logging
7. **Testing**: Unit tests, integration tests, MockMvc
8. **Database**: Normalized design, audit fields, soft deletes, proper relationships

## 📈 Future Enhancements

- [ ] Real-time notifications (WebSocket)
- [ ] Payment gateway integration
- [ ] Analytics dashboard
- [ ] Mobile app API versioning
- [ ] Microservices architecture
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Kubernetes deployment

## 📝 License

MIT License

## 👤 Author

Your Name - [GitHub](https://github.com/yourusername) | [LinkedIn](https://linkedin.com/in/yourprofile)
