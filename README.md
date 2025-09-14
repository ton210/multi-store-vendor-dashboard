# Multi-Store Vendor Dashboard

A comprehensive vendor management system that integrates with multiple e-commerce platforms (Shopify, BigCommerce, WooCommerce) to manage orders, assign vendors, and track performance.

## Features

### 🏪 Multi-Store Integration
- **Shopify**: Full API integration for order management
- **BigCommerce**: Complete order synchronization
- **WooCommerce**: REST API integration
- Unlimited stores can be added per platform

### 👥 User Management
- **Admin**: Full system access, store management, vendor approval
- **Manager**: Order management, vendor assignment
- **Vendor**: Order fulfillment, status updates, messaging

### 📦 Order Management
- Real-time order synchronization from all connected stores
- Advanced filtering and search capabilities
- Bulk operations and order assignment
- Order status tracking and history

### 🤝 Vendor System
- Vendor registration and approval workflow
- Commission rate management
- Performance tracking and analytics
- Order assignment (full or partial)

### 💬 Communication
- Built-in messaging system between admins and vendors
- Order-specific conversations
- Real-time notifications
- Message history and search

### 📊 Analytics & Reporting
- Revenue trends and performance metrics
- Vendor performance analytics
- Order fulfillment statistics
- Custom date range reporting

### 🔔 Real-time Features
- Socket.io powered real-time updates
- Live notifications for new orders and messages
- Status change notifications
- Dashboard data updates

## Tech Stack

### Backend
- **Node.js** + **Express.js** - Server framework
- **PostgreSQL** - Primary database
- **JWT** - Authentication
- **Socket.io** - Real-time communication
- **Axios** - HTTP client for API integrations
- **Bcryptjs** - Password hashing
- **Node-cron** - Scheduled tasks

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Material-UI** - Component library
- **React Router** - Client-side routing
- **Recharts** - Data visualization
- **Socket.io-client** - Real-time client
- **Date-fns** - Date utilities

### APIs Integrated
- **Shopify Admin API** - Complete order management
- **BigCommerce Store API** - Order and product data
- **WooCommerce REST API** - WordPress e-commerce integration

## Installation

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database
- Git

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/ton210/multi-store-vendor-dashboard.git
cd multi-store-vendor-dashboard
\`\`\`

### 2. Install dependencies
\`\`\`bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
\`\`\`

### 3. Set up environment variables
\`\`\`bash
# Copy environment files
cp .env.example .env
cp client/.env.example client/.env

# Edit .env with your database and API credentials
\`\`\`

### 4. Set up the database
\`\`\`bash
# Create PostgreSQL database
createdb vendor_dashboard

# Run database schema
psql -d vendor_dashboard -f database/schema.sql
\`\`\`

### 5. Start the application
\`\`\`bash
# Development mode (runs both server and client)
npm run dev

# Or run separately:
# Server only
npm run server

# Client only
npm run client
\`\`\`

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Default Login Credentials

### Admin Account
- **Email**: admin@dashboard.com
- **Password**: admin123

## Configuration

### Environment Variables

#### Server (.env)
\`\`\`env
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/vendor_dashboard
JWT_SECRET=your_super_secret_jwt_key
FRONTEND_URL=http://localhost:3000

# Store API Credentials
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
BIGCOMMERCE_CLIENT_ID=your_bigcommerce_client_id
BIGCOMMERCE_CLIENT_SECRET=your_bigcommerce_client_secret
WOOCOMMERCE_CONSUMER_KEY=your_woocommerce_consumer_key
WOOCOMMERCE_CONSUMER_SECRET=your_woocommerce_consumer_secret
\`\`\`

#### Client (client/.env)
\`\`\`env
VITE_API_URL=http://localhost:5000/api
\`\`\`

### Adding Store Integrations

1. **Shopify**
   - Create private app in Shopify admin
   - Add Admin API permissions for orders
   - Configure webhook endpoints for real-time updates

2. **BigCommerce**
   - Create app in BigCommerce Developer Portal
   - Set up OAuth flow for store authorization
   - Configure webhooks for order notifications

3. **WooCommerce**
   - Install WooCommerce REST API
   - Generate consumer key/secret
   - Enable webhook endpoints

## Deployment

### Heroku Deployment

1. **Create Heroku app**
\`\`\`bash
heroku create your-app-name
heroku addons:create heroku-postgresql:basic
\`\`\`

2. **Set environment variables**
\`\`\`bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_production_jwt_secret
# Add other environment variables...
\`\`\`

3. **Deploy**
\`\`\`bash
git push heroku main
\`\`\`

4. **Initialize database**
\`\`\`bash
heroku pg:psql < database/schema.sql
\`\`\`

## API Documentation

### Authentication
- **POST** `/api/auth/login` - User login
- **POST** `/api/auth/register` - User registration
- **GET** `/api/auth/me` - Get current user
- **PUT** `/api/auth/profile` - Update user profile

### Orders
- **GET** `/api/orders` - List orders with filters
- **GET** `/api/orders/:id` - Get single order
- **POST** `/api/orders/:id/assign` - Assign vendor to order
- **PUT** `/api/orders/:id/status` - Update order status

### Stores
- **GET** `/api/stores` - List all stores
- **POST** `/api/stores` - Add new store
- **PUT** `/api/stores/:id` - Update store
- **POST** `/api/stores/:id/sync` - Sync store orders
- **POST** `/api/stores/sync-all` - Sync all stores

### Vendors
- **GET** `/api/vendors` - List all vendors
- **GET** `/api/vendors/:id` - Get vendor details
- **PUT** `/api/vendors/:id/approval` - Approve/reject vendor
- **PUT** `/api/vendors/:id/commission` - Update commission rate

### Messages
- **GET** `/api/messages` - Get messages
- **POST** `/api/messages` - Send message
- **GET** `/api/messages/conversation/:userId` - Get conversation
- **PUT** `/api/messages/:id/read` - Mark message as read

## Contributing

1. Fork the repository
2. Create a feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add some amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please open an issue in the GitHub repository or contact the development team.

---

**Built with ❤️ by the Multi-Store Vendor Dashboard Team**