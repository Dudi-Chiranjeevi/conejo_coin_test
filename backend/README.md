conejo-inventory-backend/
├── manage.py # Django management script
├── requirements.txt # Python dependencies
├── .env.example # Environment variables template
├── .env # Your actual environment variables (create this)
├── README.md # Project documentation
├── .gitignore # Git ignore file
│
├── conejo_inventory/ # Main project directory
│ ├── **init**.py # Makes it a Python package
│ ├── settings.py # Django settings
│ ├── urls.py # URL configuration
│ ├── wsgi.py # WSGI application
│ └── asgi.py # ASGI application (for async support)
│
├── inventory/ # Main inventory app
│ ├── **init**.py # App package marker
│ ├── apps.py # App configuration
│ ├── models.py # Database models
│ ├── serializers.py # DRF serializers
│ ├── views.py # API views
│ ├── urls.py # App URL patterns
│ ├── admin.py # Django admin configuration
│ ├── signals.py # Django signals
│ ├── tests/ # Test directory
│ │ ├── **init**.py
│ │ ├── test_models.py # Model tests
│ │ ├── test_views.py # View tests
│ │ └── test_serializers.py # Serializer tests
│ ├── migrations/ # Database migrations
│ │ └── **init**.py
│ └── management/ # Custom management commands
│ ├── **init**.py
│ └── commands/
│ ├── **init**.py
│ └── seed_data.py # Data seeding command
│
├── categories/ # Categories app (future expansion)
│ ├── **init**.py
│ ├── apps.py
│ ├── models.py # If you need category-specific models
│ ├── views.py # Category-specific views
│ └── migrations/
│ └── **init**.py
│
├── locations/ # Locations app (future expansion)
│ ├── **init**.py
│ ├── apps.py
│ ├── models.py # If you need location-specific models
│ ├── views.py # Location-specific views
│ └── migrations/
│ └── **init**.py
│
├── common/ # Common utilities
│ ├── **init**.py
│ ├── apps.py
│ ├── utils/
│ │ ├── **init**.py
│ │ └── renderers.py # camelCase/snake_case converters
│ └── migrations/
│ └── **init**.py
│
├── static/ # Static files (CSS, JS, images)
│ └── admin/ # Admin interface customizations
│
├── media/ # Uploaded files (created automatically)
│
├── logs/ # Log files (created automatically)
│
└── templates/ # HTML templates (if needed)
└── admin/ # Custom admin templates
