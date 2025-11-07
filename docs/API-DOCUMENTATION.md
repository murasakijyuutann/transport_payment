# Transport Payment System - REST API Documentation

## Base URL
```
http://localhost:8080/api
```

## Authentication
Currently disabled for testing. Will be implemented in Step 4.

---

## 🚉 Journey Endpoints

### 1. Tap In (Start Journey)
Start a new journey by tapping in at a station.

**Endpoint:** `POST /api/journeys/tap-in`

**Request Body:**
```json
{
  "cardNumber": "****1234",
  "stationCode": "ST001"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Tap-in successful at Central Station",
  "journeyId": 1,
  "journeyStatus": "IN_PROGRESS",
  "stationName": "Central Station",
  "stationCode": "ST001",
  "tapTime": "2024-11-06T10:30:00",
  "currentBalance": 50.00
}
```

**Error Responses:**
- `400 Bad Request` - Invalid card or station
- `402 Payment Required` - Insufficient balance
- `404 Not Found` - Card or station not found

---

### 2. Tap Out (End Journey)
Complete a journey by tapping out at a station.

**Endpoint:** `POST /api/journeys/tap-out`

**Request Body:**
```json
{
  "cardNumber": "****1234",
  "stationCode": "ST005"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Tap-out successful. Journey completed.",
  "journeyId": 1,
  "journeyStatus": "COMPLETED",
  "entryStationName": "Central Station",
  "exitStationName": "South Bay",
  "stationName": "South Bay",
  "stationCode": "ST005",
  "tapTime": "2024-11-06T11:00:00",
  "fareAmount": 6.50,
  "zonesTransited": 3,
  "journeyDurationMinutes": 30,
  "currentBalance": 43.50,
  "dailySpending": 6.50,
  "dailyCapReached": false
}
```

**Error Responses:**
- `400 Bad Request` - No active journey, invalid station
- `402 Payment Required` - Insufficient balance for fare
- `404 Not Found` - Card or station not found

---

### 3. Get Journey History
Retrieve all journeys for a user.

**Endpoint:** `GET /api/journeys/history?userId=1`

**Query Parameters:**
- `userId` (required) - User ID

**Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "userId": 1,
    "userEmail": "john.doe@example.com",
    "cardNumber": "****1234",
    "entryStationName": "Central Station",
    "entryStationCode": "ST001",
    "exitStationName": "South Bay",
    "exitStationCode": "ST005",
    "tapInTime": "2024-11-06T10:30:00",
    "tapOutTime": "2024-11-06T11:00:00",
    "status": "COMPLETED",
    "fareAmount": 6.50,
    "finalAmount": 6.50,
    "zonesTransited": 3,
    "durationMinutes": 30
  }
]
```

---

### 4. Get Active Journey
Check if a card has an active (in-progress) journey.

**Endpoint:** `GET /api/journeys/active?cardNumber=****1234`

**Query Parameters:**
- `cardNumber` (required) - Card number

**Success Response (200 OK):**
```json
{
  "id": 2,
  "userId": 1,
  "userEmail": "john.doe@example.com",
  "cardNumber": "****1234",
  "entryStationName": "North Terminal",
  "entryStationCode": "ST002",
  "exitStationName": null,
  "exitStationCode": null,
  "tapInTime": "2024-11-06T14:00:00",
  "tapOutTime": null,
  "status": "IN_PROGRESS",
  "fareAmount": null,
  "finalAmount": null,
  "zonesTransited": null,
  "durationMinutes": null
}
```

**No Active Journey Response (204 No Content)**

---

### 5. Process Incomplete Journeys
Manually trigger processing of incomplete journeys (Admin).

**Endpoint:** `POST /api/journeys/process-incomplete`

**Success Response (200 OK):**
```json
"Incomplete journeys processed successfully"
```

---

## 👤 User Endpoints

### 6. Get User Profile
Retrieve user information.

**Endpoint:** `GET /api/users/{id}`

**Success Response (200 OK):**
```json
{
  "id": 1,
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "balance": 50.00,
  "status": "ACTIVE",
  "role": "CUSTOMER"
}
```

---

### 7. Register User
Create a new user account.

**Endpoint:** `POST /api/users/register`

**Request Body:**
```json
{
  "email": "jane.smith@example.com",
  "password": "securePassword123",
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "+1234567891"
}
```

**Success Response (201 Created):**
```json
{
  "id": 2,
  "email": "jane.smith@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "+1234567891",
  "balance": 0.00,
  "status": "ACTIVE",
  "role": "CUSTOMER"
}
```

**Validation Errors (400 Bad Request):**
```json
{
  "status": 400,
  "message": "Validation failed",
  "errors": {
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
  },
  "timestamp": "2024-11-06T10:30:00"
}
```

---

### 8. Update User Profile
Update user information.

**Endpoint:** `PUT /api/users/{id}`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phoneNumber": "+1234567899"
}
```

**Success Response (200 OK):**
```json
{
  "id": 1,
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Smith",
  "phoneNumber": "+1234567899",
  "balance": 50.00,
  "status": "ACTIVE",
  "role": "CUSTOMER"
}
```

---

### 9. Get User Balance
Check current account balance.

**Endpoint:** `GET /api/users/{id}/balance`

**Success Response (200 OK):**
```json
{
  "balance": 50.00
}
```

---

### 10. Top Up Balance
Add funds to user account.

**Endpoint:** `POST /api/users/{id}/topup`

**Request Body:**
```json
{
  "amount": 20.00
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Balance topped up successfully",
  "amountAdded": 20.00,
  "newBalance": 70.00
}
```

**Validation Error (400 Bad Request):**
```json
{
  "status": 400,
  "message": "Validation failed",
  "errors": {
    "amount": "Minimum top-up amount is £1.00"
  },
  "timestamp": "2024-11-06T10:30:00"
}
```

---

## 🏢 Station Endpoints

### 11. Get All Stations
Retrieve list of all active stations.

**Endpoint:** `GET /api/stations`

**Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "stationCode": "ST001",
    "name": "Central Station",
    "zoneNumber": 1,
    "latitude": 51.5074,
    "longitude": -0.1278,
    "status": "ACTIVE"
  },
  {
    "id": 2,
    "stationCode": "ST002",
    "name": "North Terminal",
    "zoneNumber": 1,
    "latitude": 51.5155,
    "longitude": -0.1415,
    "status": "ACTIVE"
  }
]
```

---

### 12. Get Station by ID
Retrieve specific station details.

**Endpoint:** `GET /api/stations/{id}`

**Success Response (200 OK):**
```json
{
  "id": 1,
  "stationCode": "ST001",
  "name": "Central Station",
  "zoneNumber": 1,
  "latitude": 51.5074,
  "longitude": -0.1278,
  "status": "ACTIVE"
}
```

---

### 13. Get Station by Code
Retrieve station by its code.

**Endpoint:** `GET /api/stations/code/{code}`

**Success Response (200 OK):**
```json
{
  "id": 1,
  "stationCode": "ST001",
  "name": "Central Station",
  "zoneNumber": 1,
  "latitude": 51.5074,
  "longitude": -0.1278,
  "status": "ACTIVE"
}
```

---

### 14. Get Stations by Zone
Retrieve all stations in a specific zone.

**Endpoint:** `GET /api/stations/zone/{zoneNumber}`

**Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "stationCode": "ST001",
    "name": "Central Station",
    "zoneNumber": 1,
    "latitude": 51.5074,
    "longitude": -0.1278,
    "status": "ACTIVE"
  }
]
```

---

### 15. Get All Zones
Retrieve list of all zones.

**Endpoint:** `GET /api/stations/zones`

**Success Response (200 OK):**
```json
[1, 2, 3, 4]
```

---

## 💳 Transaction Endpoints

### 16. Get User Transactions
Retrieve all transactions for a user.

**Endpoint:** `GET /api/transactions?userId=1`

**Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": 1,
    "journeyId": 1,
    "cardId": 1,
    "type": "JOURNEY_PAYMENT",
    "amount": 6.50,
    "status": "COMPLETED",
    "description": "Journey from Central Station to South Bay",
    "createdAt": "2024-11-06T11:00:00"
  }
]
```

---

### 17. Get Transactions by Date Range
Retrieve transactions within a specific date range.

**Endpoint:** `GET /api/transactions/range`

**Query Parameters:**
- `userId` (required) - User ID
- `startDate` (required) - Start date (ISO 8601 format)
- `endDate` (required) - End date (ISO 8601 format)

**Example:**
```
GET /api/transactions/range?userId=1&startDate=2024-11-01T00:00:00&endDate=2024-11-30T23:59:59
```

---

### 18. Get Transaction by ID
Retrieve specific transaction details.

**Endpoint:** `GET /api/transactions/{id}`

**Success Response (200 OK):**
```json
{
  "id": 1,
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": 1,
  "journeyId": 1,
  "cardId": 1,
  "type": "JOURNEY_PAYMENT",
  "amount": 6.50,
  "status": "COMPLETED",
  "description": "Journey from Central Station to South Bay",
  "createdAt": "2024-11-06T11:00:00"
}
```

---

### 19. Get Daily Spending
Calculate total spending for a specific day.

**Endpoint:** `GET /api/transactions/daily-spending?userId=1`

**Query Parameters:**
- `userId` (required) - User ID
- `date` (optional) - Specific date (defaults to today)

**Success Response (200 OK):**
```json
{
  "userId": 1,
  "date": "2024-11-06",
  "totalSpending": 12.50
}
```

---

## Error Response Format

All errors follow this standard format:

```json
{
  "status": 400,
  "message": "Error description",
  "timestamp": "2024-11-06T10:30:00"
}
```

### HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `204 No Content` - Request successful, no data to return
- `400 Bad Request` - Invalid input or business rule violation
- `402 Payment Required` - Insufficient balance
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Unexpected server error

---

## Testing the API

### Using the Built-in API Tester
Navigate to: `http://localhost:8080/api-tester.html`

### Using cURL

**Tap In:**
```bash
curl -X POST http://localhost:8080/api/journeys/tap-in \
  -H "Content-Type: application/json" \
  -d '{"cardNumber":"****1234","stationCode":"ST001"}'
```

**Tap Out:**
```bash
curl -X POST http://localhost:8080/api/journeys/tap-out \
  -H "Content-Type: application/json" \
  -d '{"cardNumber":"****1234","stationCode":"ST005"}'
```

**Get Balance:**
```bash
curl http://localhost:8080/api/users/1/balance
```

**Top Up:**
```bash
curl -X POST http://localhost:8080/api/users/1/topup \
  -H "Content-Type: application/json" \
  -d '{"amount":20.00}'
```

### Using Postman
Import the endpoints into Postman and test with the provided examples.