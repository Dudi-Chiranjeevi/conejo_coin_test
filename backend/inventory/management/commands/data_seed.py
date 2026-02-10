import uuid
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from inventory.models import Category, Location, InventoryItem
from faker import Faker

fake = Faker()


class Command(BaseCommand):
    help = 'Seed the database with sample data for development'

    def add_arguments(self, parser):
        parser.add_argument(
            '--client-id',
            type=str,
            help='Client ID to use for seeding data (optional)',
        )
        parser.add_argument(
            '--items',
            type=int,
            default=50,
            help='Number of inventory items to create (default: 50)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )

    def handle(self, *args, **options):
        client_id = options.get('client_id') or str(uuid.uuid4())
        num_items = options['items']
        clear_data = options['clear']

        self.stdout.write(f'Seeding data for client: {client_id}')

        if clear_data:
            self.stdout.write('Clearing existing data...')
            InventoryItem.objects.filter(client_id=client_id).delete()
            Category.objects.filter(client_id=client_id).delete()
            Location.objects.filter(client_id=client_id).delete()

        # Create admin user if not exists
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser(
                username='admin',
                email='admin@conejocoins.com',
                password='admin123'
            )
            self.stdout.write(self.style.SUCCESS('Created admin user'))

        # Create categories
        categories = self._create_categories(client_id)
        self.stdout.write(f'Created {len(categories)} categories')

        # Create locations
        locations = self._create_locations(client_id)
        self.stdout.write(f'Created {len(locations)} locations')

        # Create inventory items
        items_created = self._create_inventory_items(client_id, categories, locations, num_items)
        self.stdout.write(f'Created {items_created} inventory items')

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully seeded database with sample data for client {client_id}'
            )
        )

    def _create_categories(self, client_id):
        """Create sample categories"""
        categories = []

        # Create main categories
        collectibles = Category.objects.create(
            name='Collectibles',
            client_id=client_id,
            custom_fields={
                'condition': {'type': 'select', 'label': 'Condition', 'options': ['mint', 'near_mint', 'good', 'fair', 'poor']},
                'era': {'type': 'text', 'label': 'Era'}
            }
        )
        categories.append(collectibles)

        # Create subcategories
        coins_category = Category.objects.create(
            name='Coins',
            parent=collectibles,
            client_id=client_id,
            custom_fields={
                'year': {'type': 'number', 'label': 'Year'},
                'mint_mark': {'type': 'text', 'label': 'Mint Mark'},
                'grade': {'type': 'select', 'label': 'Grade', 'options': ['PR70', 'PR69', 'MS70', 'MS69', 'MS68', 'MS67', 'MS66', 'MS65']},
                'cert_number': {'type': 'text', 'label': 'Certificate Number'}
            }
        )
        categories.append(coins_category)

        stamps_category = Category.objects.create(
            name='Stamps',
            parent=collectibles,
            client_id=client_id,
            custom_fields={
                'country': {'type': 'text', 'label': 'Country'},
                'year_issued': {'type': 'number', 'label': 'Year Issued'},
                'condition': {'type': 'select', 'label': 'Condition', 'options': ['mint', 'used', 'damaged']},
                'catalog_number': {'type': 'text', 'label': 'Catalog Number'}
            }
        )
        categories.append(stamps_category)

        cards_category = Category.objects.create(
            name='Trading Cards',
            parent=collectibles,
            client_id=client_id,
            custom_fields={
                'sport': {'type': 'text', 'label': 'Sport'},
                'player': {'type': 'text', 'label': 'Player Name'},
                'year': {'type': 'number', 'label': 'Year'},
                'card_number': {'type': 'text', 'label': 'Card Number'},
                'set_name': {'type': 'text', 'label': 'Set Name'}
            }
        )
        categories.append(cards_category)

        bullion_category = Category.objects.create(
            name='Bullion',
            client_id=client_id,
            custom_fields={
                'metal_type': {'type': 'select', 'label': 'Metal Type', 'options': ['gold', 'silver', 'platinum', 'palladium']},
                'purity': {'type': 'text', 'label': 'Purity'},
                'mint': {'type': 'text', 'label': 'Mint'},
                'year': {'type': 'number', 'label': 'Year'}
            }
        )
        categories.append(bullion_category)

        return categories

    def _create_locations(self, client_id):
        """Create sample locations"""
        locations = []

        # Create main building
        main_building = Location.objects.create(
            name='Main Store',
            type='building',
            client_id=client_id
        )
        locations.append(main_building)

        # Create rooms
        storage_room = Location.objects.create(
            name='Storage Room A',
            type='room',
            parent=main_building,
            client_id=client_id
        )
        locations.append(storage_room)

        display_room = Location.objects.create(
            name='Display Room',
            type='room',
            parent=main_building,
            client_id=client_id
        )
        locations.append(display_room)

        # Create shelves in storage room
        for i in range(1, 6):
            shelf = Location.objects.create(
                name=f'Shelf {i}',
                type='shelf',
                parent=storage_room,
                client_id=client_id
            )
            locations.append(shelf)

        # Create display cases
        for i in range(1, 4):
            case = Location.objects.create(
                name=f'Display Case {i}',
                type='cabinet',
                parent=display_room,
                client_id=client_id
            )
            locations.append(case)

        # Create warehouse
        warehouse = Location.objects.create(
            name='Warehouse',
            type='building',
            client_id=client_id
        )
        locations.append(warehouse)

        return locations

    def _create_inventory_items(self, client_id, categories, locations, num_items):
        """Create sample inventory items"""
        items_created = 0
        statuses = ['in_store', 'in_transit', 'consigned', 'sold', 'ebay']

        for _ in range(num_items):
            category = fake.random_element(categories)
            location = fake.random_element(locations)
            status = fake.random_element(statuses)

            # Generate attributes based on category
            attributes = self._generate_attributes(category)

            item = InventoryItem.objects.create(
                name=self._generate_item_name(category),
                description=fake.text(max_nb_chars=200),
                category=category,
                status=status,
                price=Decimal(str(fake.pydecimal(left_digits=4, right_digits=2, positive=True, min_value=10, max_value=5000))),
                location=location if status == 'in_store' else None,
                notes=fake.text(max_nb_chars=100) if fake.boolean(chance_of_getting_true=30) else '',
                is_consigned=status == 'consigned',
                weight=Decimal(str(fake.pydecimal(left_digits=2, right_digits=2, positive=True, min_value=1, max_value=100))) if fake.boolean(chance_of_getting_true=60) else None,
                weight_unit=fake.random_element(['g', 'oz']) if fake.boolean(chance_of_getting_true=60) else None,
                attributes=attributes,
                client_id=client_id,
                images=self._generate_image_urls() if fake.boolean(chance_of_getting_true=40) else []
            )
            items_created += 1

        return items_created

    def _generate_item_name(self, category):
        """Generate realistic item names based on category"""
        if category.name == 'Coins':
            years = range(1900, 2024)
            coin_types = ['Penny', 'Nickel', 'Dime', 'Quarter', 'Half Dollar', 'Dollar', 'Eagle', 'Buffalo']
            return f"{fake.random_element(years)} {fake.random_element(coin_types)}"
        
        elif category.name == 'Stamps':
            countries = ['USA', 'Canada', 'UK', 'Germany', 'France', 'Japan']
            return f"{fake.random_element(countries)} {fake.random_element(range(1950, 2023))} Commemorative"
        
        elif category.name == 'Trading Cards':
            sports = ['Baseball', 'Basketball', 'Football', 'Hockey']
            return f"{fake.first_name()} {fake.last_name()} {fake.random_element(sports)} Card"
        
        elif category.name == 'Bullion':
            metals = ['Gold', 'Silver', 'Platinum']
            forms = ['Coin', 'Bar', 'Round']
            return f"{fake.random_element(metals)} {fake.random_element(forms)}"
        
        else:
            return fake.catch_phrase()

    def _generate_attributes(self, category):
        """Generate category-specific attributes"""
        if category.name == 'Coins':
            return {
                'year': fake.random_element(range(1900, 2024)),
                'mint_mark': fake.random_element(['P', 'D', 'S', 'W', '']),
                'grade': fake.random_element(['PR70', 'PR69', 'MS70', 'MS69', 'MS68', 'MS67', 'MS66', 'MS65']),
                'cert_number': fake.bothify(text='####-####'),
            }
        
        elif category.name == 'Stamps':
            return {
                'country': fake.country(),
                'year_issued': fake.random_element(range(1950, 2023)),
                'condition': fake.random_element(['mint', 'used', 'damaged']),
                'catalog_number': fake.bothify(text='SC-###'),
            }
        
        elif category.name == 'Trading Cards':
            return {
                'sport': fake.random_element(['Baseball', 'Basketball', 'Football', 'Hockey']),
                'player': f"{fake.first_name()} {fake.last_name()}",
                'year': fake.random_element(range(1980, 2023)),
                'card_number': fake.bothify(text='###'),
                'set_name': fake.catch_phrase(),
            }
        
        elif category.name == 'Bullion':
            return {
                'metal_type': fake.random_element(['gold', 'silver', 'platinum', 'palladium']),
                'purity': fake.random_element(['.999', '.9999', '.925']),
                'mint': fake.company(),
                'year': fake.random_element(range(2000, 2024)),
            }
        
        return {}

    def _generate_image_urls(self):
        """Generate sample image URLs"""
        num_images = fake.random_element(range(1, 4))
        return [f"https://example.com/images/{fake.uuid4()}.jpg" for _ in range(num_images)]