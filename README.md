# 🐍 Conejo Coin Inventory Management Backend

Complete Django REST API implementation for managing high-value collectibles inventory with PostgreSQL, multi-tenant support, and comprehensive validation.

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- PostgreSQL 12+
- pip or pipenv

### Installation

1. **Clone and setup virtual environment**
```bash
git clone <your-repo>
cd conejo-inventory-backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

3. **Database setup**
```bash
# Create PostgreSQL database
createdb conejo_inventory

# Copy environment variables
cp .env.example .env
# Edit .env with your database credentials
```

4. **Run migrations**
```bash
python manage.py makemigrations inventory
python manage.py migrate
```

5. **Create superuser and seed data**
```bash
python manage.py createsuperuser
python manage.py seed_data --items 100
```

6. **Start development server**
```bash
python manage.py runserver
```

Visit http://localhost:8000/admin/ to access the admin interface.

## 📊 API Endpoints

### Authentication
- `POST /api-auth/login/` - Login
- `POST /api-auth/logout/` - Logout

### Inventory Items
- `GET /api/v1/inventory_items/` - List items (with filtering, search, pagination)
- `POST /api/v1/inventory_items/` - Create item
- `GET /api/v1/inventory_items/{id}/` - Retrieve item details
- `PATCH /api/v1/inventory_items/{id}/` - Update item
- `DELETE /api/v1/inventory_items/{id}/` - Delete item
- `PATCH /api/v1/inventory_items/{id}/update_status/` - Update item status only
- `GET /api/v1/inventory_items/by_status/?client_id={id}` - Group items by status
- `GET /api/v1/inventory_items/stats/?client_id={id}` - Get inventory statistics
- `POST /api/v1/inventory_items/bulk_update_status/` - Bulk update item statuses

### Categories
- `GET /api/v1/categories/` - List categories
- `POST /api/v1/categories/` - Create category
- `GET /api/v1/categories/{id}/` - Retrieve category
- `PATCH /api/v1/categories/{id}/` - Update category
- `GET /api/v1/categories/tree/?client_id={id}` - Get hierarchical category tree
- `GET /api/v1/categories/{id}/items/` - Get items in category

### Locations
- `GET /api/v1/locations/` - List locations
- `POST /api/v1/locations/` - Create location
- `GET /api/v1/locations/{id}/` - Retrieve location
- `PATCH /api/v1/locations/{id}/` - Update location
- `GET /api/v1/locations/tree/?client_id={id}` - Get hierarchical location tree
- `GET /api/v1/locations/{id}/items/` - Get items at location

### Status History
- `GET /api/v1/status_history/` - List status changes (read-only)
- `GET /api/v1/status_history/?item={id}` - Get history for specific item

## 🔍 Advanced Filtering

### Inventory Items Filtering
```bash
# Filter by status
GET /api/v1/inventory_items/?status=in_store

# Filter by category
GET /api/v1/inventory_items/?category={category_id}

# Filter by price range
GET /api/v1/inventory_items/?min_price=100&max_price=500

# Filter by date range
GET /api/v1/inventory_items/?date_added_after=2023-01-01&date_added_before=2023-12-31

# Search in name, description, and attributes
GET /api/v1/inventory_items/?search_attributes=gold

# Filter items with/without images
GET /api/v1/inventory_items/?has_images=true

# Combine filters
GET /api/v1/inventory_items/?status=in_store&category={id}&min_price=100&search=coin
```

### Search and Ordering
```bash
# Search by name/description
GET /api/v1/inventory_items/?search=penny

# Order results
GET /api/v1/inventory_items/?ordering=-date_added,name
GET /api/v1/inventory_items/?ordering=price
```

## 📋 Data Validation Examples

### Creating a Coin Item
```json
POST /api/v1/inventory_items/
{
    "name": "1909-S VDB Penny",
    "description": "Rare Lincoln penny in excellent condition",
    "categoryId": "category-uuid-here",
    "status": "inStore",
    "price": "850.00",
    "locationId": "location-uuid-here",
    "weight": "3.11",
    "weightUnit": "g",
    "attributes": {
        "year": 1909,
        "mintMark": "S",
        "grade": "MS65",
        "certNumber": "1234-5678"
    },
    "images": [
        "https://example.com/coin-front.jpg",
        "https://example.com/coin-back.jpg"
    ],
    "clientId": "client-uuid-here"
}
```

### Category-Specific Validation Rules

**Coins** (required attributes):
- `cert_number` - Certificate number
- `grade` - Must be valid grade (PR70, PR69, MS70, etc.)
- `year` - Year minted

**Stamps** (optional validations):
- `condition` - Must be 'mint', 'used', or 'damaged'

## 🏗️ Project Structure

```
backend/
├── conejo_inventory/          # Main project settings
│   ├── __init__.py
│   ├── settings.py           # Django configuration
│   ├── urls.py              # URL routing
│   └── wsgi.py              # WSGI application
├── inventory/                # Main inventory app
│   ├── models.py            # Database models
│   ├── serializers.py       # DRF serializers
│   ├── views.py             # API views
│   ├── admin.py             # Admin interface
│   ├── signals.py           # Django signals
│   └── management/
│       └── commands/
│           └── seed_data.py # Data seeding command
├── common/                  # Common utilities
│   └── utils/
│       └── renderers.py     # camelCase/snake_case conversion
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
└── README.md               # This file
```


## 🔐 Security Features

### Multi-Tenant Support
All models include `client_id` for future multi-tenancy:
```python
# Filter by client automatically
queryset = InventoryItem.objects.filter(client_id=request.user.client_id)
```

### Validation & Sanitization
- **JSONB input validation** - Prevents malicious JSON injection
- **Price validation** - Must be positive decimal
- **Cross-field validation** - Weight requires weight_unit
- **Category-specific rules** - Coins require cert_number, grade, year

### Production Security
```python
# In settings.py for production
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
CSRF_TRUSTED_ORIGINS = ['https://yourdomain.com']
```

## 📈 Performance Optimizations

### Database Indexing
- **GIN indexes** on JSONB fields for fast attribute searches
- **Composite indexes** on frequently filtered combinations
- **Foreign key indexes** for joins

### Query Optimization
```python
# Optimized querysets with select_related
queryset = InventoryItem.objects.select_related(
    'category', 'location'
).prefetch_related('status_history')
```

### API Response Optimization
- **Lightweight list serializer** for list views
- **Pagination** (20 items per page default)
- **Field filtering** in responses

## 🚀 Production Deployment

### Environment Setup
```bash
# Production environment variables
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
SECRET_KEY=your-production-secret-key

# Database
DB_HOST=your-production-db-host
DB_NAME=conejo_inventory_prod
DB_USER=prod_user
DB_PASSWORD=secure-password

# Security
SECURE_SSL_REDIRECT=True
SECURE_PROXY_SSL_HEADER=HTTP_X_FORWARDED_PROTO,https
```

### Production Checklist
- [ ] Set `DEBUG=False`
- [ ] Configure production database
- [ ] Set up SSL/HTTPS
- [ ] Configure static file serving
- [ ] Set up logging and monitoring
- [ ] Run security checks: `python manage.py check --deploy`
- [ ] Set up backup strategy
- [ ] Configure CORS for frontend domain

### Docker Deployment (Optional)
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "conejo_inventory.wsgi:application", "--bind", "0.0.0.0:8000"]
```


### Other Useful Commands
```bash
# Create database backup
python manage.py dumpdata inventory > backup.json

# Load data from backup
python manage.py loaddata backup.json

# Reset database
python manage.py flush

# Check for issues
python manage.py check
python manage.py check --deploy  # Production readiness
```

## 🛠️ Development Tips

### Code Quality
```bash
# Format code
black .
isort .

# Lint code  
flake8

# Type checking (optional)
mypy inventory/
```

### API Testing with curl
```bash
# Get authentication token
curl -X POST http://localhost:8000/api-auth/login/ \
     -d "username=admin&password=admin123"

# Create item
curl -X POST http://localhost:8000/api/v1/inventory_items/ \
     -H "Authorization: Token your-token-here" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Item", "price": "100.00", ...}'
```

## 📝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Run tests: `pytest`
5. Push to branch: `git push origin feature/amazing-feature`
6. Create Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
- Create GitHub issue for bugs
- Check existing documentation
- Review test files for usage examples

---

Built with ❤️ using Django REST Framework and PostgreSQL
