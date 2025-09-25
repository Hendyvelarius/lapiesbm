# eSBM Backend

Backend API untuk e-Sistem Biaya Manufaktur (Manufacturing Cost System) menggunakan Node.js, Express.js, dan SQL Server.

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- SQL Server database
- npm or yarn

### Installation

1. **Clone and navigate to backend directory**
```bash
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
```
Edit `.env` file with your SQL Server database credentials and configuration.

4. **Start the server**
```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3001`

## 📁 Project Structure

```
src/
├── controllers/          # Request handlers and business logic
│   ├── productController.js
│   ├── hppController.js
│   ├── masterController.js
│   └── expiryCostController.js
├── models/              # SQL database models and procedures
│   ├── sqlModel.js
│   ├── productModel.js
│   ├── hppModel.js
│   └── expiryCostModel.js
├── routes/              # API route definitions
│   ├── index.js
│   ├── productRoutes.js
│   ├── hppRoutes.js
│   └── masterRoutes.js
├── middleware/          # Custom middleware functions
│   ├── cors.js
│   ├── errorHandler.js
│   └── rateLimiter.js
└── server.js           # Main application entry point
```

## 🛠 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests

## 📊 Database

The application uses SQL Server with stored procedures and direct SQL queries for optimal performance.

### Key Tables
- **Products** - Product information and formulas
- **HPP** - Cost calculation data
- **Materials** - Raw materials and packaging
- **Groups** - Product groupings and classifications

## 🔗 API Endpoints

### Products & Formulas
- `GET /api/products/formula` - Get all formulas
- `GET /api/products/chosen-formula` - Get chosen formulas
- `POST /api/products/chosen-formula` - Create chosen formula
- `PUT /api/products/chosen-formula/:id` - Update chosen formula
- `DELETE /api/products/chosen-formula/:id` - Delete chosen formula

### HPP (Cost Calculation)
- `GET /api/hpp` - Get HPP data
- `POST /api/hpp/generate` - Generate HPP calculation

### Master Data
- `GET /api/master/currency` - Get currency list
- `GET /api/master/material` - Get materials
- `GET /api/master/group` - Get product groups
- `POST /api/master/group` - Create product group
- `PUT /api/master/group/:id` - Update product group
- `DELETE /api/master/group/:id` - Delete product group

### Expiry Cost Management
- `GET /api/expiry-cost` - Get expired materials
- `POST /api/expiry-cost` - Create expired material record
- `POST /api/expiry-cost/generate` - Generate expiry cost allocation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed API documentation.

## 🔧 Features

- **RESTful API** - Clean and consistent API design
- **SQL Server Integration** - Direct database connections with stored procedures
- **Error Handling** - Comprehensive error handling middleware
- **Input Validation** - Request validation and sanitization
- **CORS Support** - Cross-origin resource sharing
- **Rate Limiting** - API rate limiting for security
- **Security** - Helmet.js for security headers
- **Logging** - Morgan for HTTP request logging
- **Environment Config** - Environment-based configuration

## 🔒 Security Features

- **Helmet.js** - Security headers
- **CORS** - Configured for frontend domains
- **Rate Limiting** - Prevents API abuse
- **Input Validation** - Server-side validation
- **Error Handling** - Prevents information leakage

## 🚀 Deployment

### Environment Variables
Make sure to set these in production:
- `NODE_ENV=production`
- `PORT=3001`
- SQL Server database credentials
- `SESSION_SECRET` for sessions

### Database
- Ensure SQL Server is properly configured
- Database schema should be created via SQL scripts
- Stored procedures should be deployed

### Process Management
Consider using PM2 for production process management:
```bash
npm install -g pm2
pm2 start src/server.js --name "esbm-api"
```

## 🤝 Contributing

1. Follow the established MVC pattern
2. Add proper error handling
3. Include input validation
4. Write meaningful commit messages
5. Update API documentation

## 📝 License

This project is licensed under the ISC License.
