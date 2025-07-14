# eSBM Backend

Backend API untuk e-Sistem Biaya Manufaktur (Manufacturing Cost System) menggunakan Node.js, Express.js, dan Sequelize ORM.

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL or MySQL database
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
Edit `.env` file with your database credentials and configuration.

4. **Setup database**
```bash
# Create database
npm run db:create

# Run migrations
npm run db:migrate

# (Optional) Run seeders
npm run db:seed
```

5. **Start the server**
```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 📁 Project Structure

```
src/
├── controllers/          # Request handlers and business logic
│   ├── productController.js
│   └── hppController.js
├── models/              # Sequelize database models
│   ├── index.js
│   ├── product.js
│   ├── hpp.js
│   └── hppingredient.js
├── routes/              # API route definitions
│   ├── index.js
│   ├── productRoutes.js
│   └── hppRoutes.js
├── middleware/          # Custom middleware functions
│   ├── cors.js
│   ├── errorHandler.js
│   └── rateLimiter.js
├── services/            # Business logic and data processing
│   └── hppService.js
└── server.js           # Main application entry point
```

## 🛠 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Run database seeders
- `npm run db:reset` - Reset database (drop, create, migrate)

## 📊 Database Models

### Product
- Stores basic product information
- Fields: namaProduk, harga, jenisProduk, bentuk, kategori, pabrik, expiry

### HPP (Cost of Goods Sold)
- Stores cost calculation data
- Fields: biayaTenagaKerja, biayaOverhead, totalBahanBaku, totalHPP, status
- Status: draft → confirmed → archived

### HPPIngredient
- Stores individual ingredient/material data
- Fields: namaBahan, jumlah, satuan, hargaSatuan, totalHarga, supplier info

## 🔗 API Endpoints

### Products
- `GET /api/products` - Get all products (with pagination and filtering)
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### HPP
- `GET /api/hpp` - Get all HPP records (with pagination and filtering)
- `GET /api/hpp/:id` - Get HPP by ID
- `POST /api/hpp` - Create new HPP with ingredients
- `PATCH /api/hpp/:id/status` - Update HPP status
- `DELETE /api/hpp/:id` - Delete HPP (draft only)

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed API documentation.

## 🔧 Features

- **RESTful API** - Clean and consistent API design
- **Database ORM** - Sequelize for database operations
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
- **Input Validation** - Sequelize model validation
- **Error Handling** - Prevents information leakage

## 🚀 Deployment

### Environment Variables
Make sure to set these in production:
- `NODE_ENV=production`
- `PORT=5000`
- Database credentials
- `SESSION_SECRET` for sessions

### Database
- Run migrations in production: `npm run db:migrate`
- Set `DB_DIALECT` to your database type (postgres, mysql, etc.)

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
