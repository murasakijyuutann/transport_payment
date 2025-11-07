# Transport Payment System - Interactive Website

## 🚀 Overview

A fully functional, modern web application for managing transport payments with a tap-in/tap-out journey system. Built with **Bootstrap 5** frontend and **Spring Boot 3.4** backend.

## ✨ Features

### 🎨 Frontend Features
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Modern UI**: Clean Bootstrap 5 interface with Font Awesome icons
- **Real-time Updates**: Live balance and journey tracking
- **Interactive Dashboards**: Visual cards, tables, and statistics
- **JWT Authentication**: Secure token-based authentication
- **Form Validation**: Client-side and server-side validation

### 🔐 User Management
- User registration with validation
- Secure login (JWT tokens)
- Profile management
- Password change functionality
- Balance top-up system

### 💳 Payment Cards
- Add multiple payment cards (Credit/Debit)
- Set default card
- Block/delete cards
- Card expiry validation
- Beautiful gradient card designs

### 🚇 Journey Management
- Tap in at entry station
- Tap out at exit station
- Zone-based fare calculation
- Journey history with filters
- Active journey tracking
- Duration calculation

### 💰 Transactions
- Complete transaction history
- Filter by type and date range
- Top-up tracking
- Payment records
- Visual transaction icons

## 🎯 Demo Credentials

```
Email: demo@example.com
Password: demo123
Initial Balance: $50.00
```

## 📁 Project Structure

```
src/main/resources/static/
├── index.html              # Login page
├── register.html           # Registration page
├── dashboard.html          # Main dashboard
├── cards.html              # Card management
├── journeys.html           # Journey history
├── transactions.html       # Transaction history
├── profile.html            # User profile
├── css/
│   └── style.css          # Custom styles
└── js/
    ├── api.js             # API utilities & config
    ├── auth.js            # Login logic
    ├── register.js        # Registration logic
    ├── dashboard.js       # Dashboard functionality
    ├── cards.js           # Card management
    ├── journeys.js        # Journey tracking
    ├── transactions.js    # Transaction display
    └── profile.js         # Profile management
```

## 🚀 Getting Started

### Prerequisites
- Java 21
- Maven 3.x
- Modern web browser

### Running the Application

1. **Start the Backend:**
   ```bash
   ./mvnw spring-boot:run
   ```

2. **Access the Website:**
   - Open browser: `http://localhost:8080`
   - Or directly: `http://localhost:8080/index.html`

3. **Login:**
   - Use demo credentials or register a new account

## 📱 Pages Overview

### 1. Login Page (`/`)
- Email/password authentication
- Remember me option
- Link to registration
- Demo credentials displayed

### 2. Registration Page (`/register.html`)
- First/Last name
- Email & phone number
- Password with confirmation
- Terms acceptance

### 3. Dashboard (`/dashboard.html`)
- Current balance display with top-up button
- Quick tap in/tap out actions
- Monthly journey statistics
- Recent journeys table
- Active journey alert

### 4. Cards Page (`/cards.html`)
- Beautiful gradient card display
- Add new cards (16-digit validation)
- Set default card (starred)
- Block/delete cards
- Card expiry tracking

### 5. Journeys Page (`/journeys.html`)
- Complete journey history
- Filter by status and date
- Zone information
- Duration calculation
- Statistics cards (total, completed, in progress, spent)

### 6. Transactions Page (`/transactions.html`)
- All financial transactions
- Top-ups (green arrow down)
- Payments (red arrow up)
- Refunds (blue undo icon)
- Balance after each transaction
- Filter by type and date range

### 7. Profile Page (`/profile.html`)
- View/edit personal information
- Change password
- Account statistics
- Member since date

## 🎨 Design Features

### Color Scheme
- **Primary**: Bootstrap Blue (#0d6efd)
- **Success**: Green for top-ups and completed items
- **Danger**: Red for payments and errors
- **Warning**: Yellow for in-progress items
- **Info**: Cyan for refunds and information

### Card Designs
- **Credit Cards**: Purple-blue gradient
- **Debit Cards**: Pink-red gradient
- **Default Card**: Golden border with glow effect
- **Card Chip**: Gold metallic appearance

### Responsive Breakpoints
- Mobile: < 768px
- Tablet: 768px - 992px
- Desktop: > 992px

## 🔌 API Integration

The frontend communicates with backend REST APIs:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### User Management
- `GET /api/users/{id}` - Get user profile
- `PUT /api/users/{id}` - Update profile
- `POST /api/users/{id}/balance/add` - Add balance
- `PUT /api/users/{id}/password` - Change password

### Card Management
- `GET /api/cards/user/{userId}` - Get user cards
- `POST /api/cards/user/{userId}` - Add new card
- `PUT /api/cards/{cardId}/set-default` - Set default card
- `DELETE /api/cards/{cardId}` - Delete card

### Journey Management
- `GET /api/journeys/user/{userId}` - Get journeys
- `POST /api/journeys/tap-in` - Start journey
- `PUT /api/journeys/{id}/tap-out` - End journey

### Transactions
- `GET /api/transactions/user/{userId}` - Get transactions

### Stations
- `GET /api/stations` - Get all stations

## 🔒 Security Features

### Frontend Security
- JWT token storage in localStorage
- Automatic token expiration handling
- Protected routes (redirect to login)
- CSRF protection disabled for API calls
- Authorization headers on all authenticated requests

### Session Management
- Token stored in localStorage
- User data cached for performance
- Auto-logout on 401 responses
- Remember me functionality

## 📊 Sample Data

The application initializes with:

### Stations (9 total)
**Zone 1:**
- Central Station
- City Hall
- Downtown

**Zone 2:**
- Uptown
- Midtown
- West End

**Zone 3:**
- Suburban North
- Suburban South
- Airport

### Demo User
- Name: Demo User
- Email: demo@example.com
- Password: demo123
- Balance: $50.00
- Role: CUSTOMER

## 🛠️ Customization

### Changing API Base URL
Edit `js/api.js`:
```javascript
const API_BASE_URL = 'http://your-api-url:port/api';
```

### Modifying Colors
Edit `css/style.css`:
```css
:root {
    --primary-color: #your-color;
    --success-color: #your-color;
    /* ... */
}
```

### Adding New Pages
1. Create HTML file in `static/`
2. Create corresponding JS file in `static/js/`
3. Update navigation in all pages
4. Add authentication check if needed

## 🐛 Troubleshooting

### Login Not Working
- Check backend is running on port 8080
- Verify demo user was created (check logs)
- Clear browser localStorage
- Check browser console for errors

### Cards Not Loading
- Ensure user is authenticated
- Check JWT token in localStorage
- Verify API endpoint is accessible
- Check network tab in browser DevTools

### Styles Not Applying
- Clear browser cache
- Check CSS file path in HTML
- Verify Bootstrap CDN is accessible
- Inspect element to see applied styles

## 📝 Future Enhancements

- [ ] Real-time notifications
- [ ] Journey cost calculator before travel
- [ ] Monthly pass purchases
- [ ] Transaction export to PDF/CSV
- [ ] Dark mode toggle
- [ ] Multi-language support
- [ ] Progressive Web App (PWA) support
- [ ] Touch ID/Face ID for quick login
- [ ] QR code for quick tap in/out

## 🎓 Technologies Used

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling
- **JavaScript (ES6+)** - Logic
- **Bootstrap 5.3.2** - UI Framework
- **Font Awesome 6.4.0** - Icons

### Backend
- **Spring Boot 3.4.0** - Framework
- **Spring Security** - Authentication
- **JWT (io.jsonwebtoken)** - Tokens
- **Hibernate/JPA** - ORM
- **H2 Database** - In-memory DB
- **PostgreSQL Driver** - Production DB support

## 📄 License

This project is part of a portfolio demonstration.

## 👨‍💻 Developer Notes

### Code Organization
- All API calls centralized in `api.js`
- Utility functions shared across pages
- Consistent error handling
- Clean separation of concerns

### Best Practices Followed
- DRY (Don't Repeat Yourself)
- Responsive design first
- Accessibility considerations
- Cross-browser compatibility
- Performance optimization
- Security best practices

## 🌐 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 📞 API Testing

Use Swagger UI for API testing:
- URL: `http://localhost:8080/swagger-ui.html`
- All endpoints documented
- Try it out feature available

## 🎉 Conclusion

This is a production-ready, portfolio-quality web application demonstrating:
- Modern web development practices
- Full-stack integration
- Secure authentication
- Responsive design
- Clean code architecture
- Professional UI/UX

Perfect for showcasing in interviews and portfolio presentations!
