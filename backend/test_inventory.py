import pytest
import uuid
from decimal import Decimal
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status
from model_bakery import baker
from inventory.models import Category, Location, InventoryItem, StatusHistory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )


@pytest.fixture
def client_id():
    return uuid.uuid4()


@pytest.fixture
def category(client_id):
    return baker.make(Category, name='Coins', client_id=client_id)


@pytest.fixture
def location(client_id):
    return baker.make(Location, name='Shelf 1', type='shelf', client_id=client_id)


@pytest.fixture
def inventory_item(category, location, client_id):
    return baker.make(
        InventoryItem,
        name='Test Coin',
        category=category,
        location=location,
        price=Decimal('100.00'),
        client_id=client_id,
        status='in_store'
    )


@pytest.mark.django_db
class TestCategory:
    def test_category_creation(self, client_id):
        """Test basic category creation"""
        category = Category.objects.create(
            name='Stamps',
            client_id=client_id,
            custom_fields={'grade': {'type': 'text', 'label': 'Grade'}}
        )
        
        assert category.name == 'Stamps'
        assert category.client_id == client_id
        assert 'grade' in category.custom_fields

    def test_category_hierarchy(self, client_id):
        """Test parent-child relationship"""
        parent = baker.make(Category, name='Collectibles', client_id=client_id)
        child = baker.make(Category, name='Coins', parent=parent, client_id=client_id)
        
        assert child.parent == parent
        assert child.client_id == parent.client_id

    def test_category_validation_different_client(self, client_id):
        """Test validation when parent belongs to different client"""
        parent = baker.make(Category, name='Parent', client_id=uuid.uuid4())
        
        with pytest.raises(ValidationError):
            child = Category(
                name='Child',
                parent=parent,
                client_id=client_id
            )
            child.full_clean()


@pytest.mark.django_db
class TestLocation:
    def test_location_creation(self, client_id):
        """Test basic location creation"""
        location = Location.objects.create(
            name='Storage Room A',
            type='room',
            client_id=client_id
        )
        
        assert location.name == 'Storage Room A'
        assert location.type == 'room'
        assert location.client_id == client_id

    def test_location_hierarchy(self, client_id):
        """Test hierarchical locations"""
        building = baker.make(Location, name='Main Building', type='building', client_id=client_id)
        room = baker.make(Location, name='Room 101', type='room', parent=building, client_id=client_id)
        shelf = baker.make(Location, name='Shelf A', type='shelf', parent=room, client_id=client_id)
        
        assert shelf.parent == room
        assert room.parent == building


@pytest.mark.django_db
class TestInventoryItem:
    def test_inventory_item_creation(self, category, location, client_id):
        """Test basic inventory item creation"""
        item = InventoryItem.objects.create(
            name='1909-S VDB Penny',
            description='Rare penny in excellent condition',
            category=category,
            location=location,
            price=Decimal('500.00'),
            status='in_store',
            client_id=client_id,
            attributes={
                'year': 1909,
                'mint_mark': 'S',
                'grade': 'MS65'
            }
        )
        
        assert item.name == '1909-S VDB Penny'
        assert item.price == Decimal('500.00')
        assert item.status == 'in_store'
        assert item.attributes['grade'] == 'MS65'

    def test_inventory_item_validation(self, category, location, client_id):
        """Test model validation"""
        # Test negative price
        with pytest.raises(ValidationError):
            item = InventoryItem(
                name='Test Item',
                category=category,
                location=location,
                price=Decimal('-10.00'),
                client_id=client_id
            )
            item.full_clean()

    def test_weight_validation(self, category, location, client_id):
        """Test weight and weight_unit validation"""
        # Weight without unit should fail
        with pytest.raises(ValidationError):
            item = InventoryItem(
                name='Test Item',
                category=category,
                location=location,
                price=Decimal('100.00'),
                weight=Decimal('10.5'),
                client_id=client_id
            )
            item.full_clean()

    def test_cross_client_validation(self, client_id):
        """Test that category and location must belong to same client"""
        other_client_id = uuid.uuid4()
        category = baker.make(Category, client_id=other_client_id)
        location = baker.make(Location, client_id=other_client_id)
        
        with pytest.raises(ValidationError):
            item = InventoryItem(
                name='Test Item',
                category=category,
                location=location,
                price=Decimal('100.00'),
                client_id=client_id  # Different client
            )
            item.full_clean()


@pytest.mark.django_db
class TestStatusHistory:
    def test_status_history_creation(self, inventory_item, user):
        """Test status history creation"""
        history = StatusHistory.objects.create(
            item=inventory_item,
            old_status='in_store',
            new_status='sold',
            user=user,
            notes='Sold to customer'
        )
        
        assert history.item == inventory_item
        assert history.old_status == 'in_store'
        assert history.new_status == 'sold'
        assert history.user == user

    def test_status_history_ordering(self, inventory_item, user):
        """Test that status history is ordered by timestamp desc"""
        # Create multiple history entries
        history1 = baker.make(StatusHistory, item=inventory_item, old_status='in_store', new_status='consigned')
        history2 = baker.make(StatusHistory, item=inventory_item, old_status='consigned', new_status='sold')
        
        histories = list(StatusHistory.objects.all())
        assert histories[0].timestamp >= histories[1].timestamp


@pytest.mark.django_db
class TestInventoryAPI:
    def test_inventory_item_list(self, api_client, user, inventory_item):
        """Test GET /api/v1/inventory_items/"""
        api_client.force_authenticate(user=user)
        
        response = api_client.get('/api/v1/inventory_items/')
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['name'] == inventory_item.name

    def test_inventory_item_create(self, api_client, user, category, location, client_id):
        """Test POST /api/v1/inventory_items/"""
        api_client.force_authenticate(user=user)
        
        data = {
            'name': 'New Test Item',
            'description': 'Test description',
            'category': str(category.id),
            'location': str(location.id),
            'price': '150.00',
            'status': 'in_store',
            'client_id': str(client_id),
            'attributes': {
                'grade': 'MS67',
                'year': 2021
            }
        }
        
        response = api_client.post('/api/v1/inventory_items/', data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New Test Item'
        assert response.data['price'] == '150.00'
        
        # Verify status history was created
        item = InventoryItem.objects.get(id=response.data['id'])
        assert item.status_history.count() == 1

    def test_inventory_item_update(self, api_client, user, inventory_item):
        """Test PATCH /api/v1/inventory_items/{id}/"""
        api_client.force_authenticate(user=user)
        
        data = {
            'name': 'Updated Item Name',
            'price': '200.00'
        }
        
        response = api_client.patch(
            f'/api/v1/inventory_items/{inventory_item.id}/', 
            data, 
            format='json'
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Updated Item Name'
        assert response.data['price'] == '200.00'

    def test_inventory_item_status_update(self, api_client, user, inventory_item):
        """Test PATCH /api/v1/inventory_items/{id}/update_status/"""
        api_client.force_authenticate(user=user)
        
        data = {
            'status': 'sold',
            'notes': 'Sold to collector'
        }
        
        response = api_client.patch(
            f'/api/v1/inventory_items/{inventory_item.id}/update_status/',
            data,
            format='json'
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'sold'
        
        # Verify status history was created
        inventory_item.refresh_from_db()
        latest_history = inventory_item.status_history.first()
        assert latest_history.new_status == 'sold'
        assert latest_history.notes == 'Sold to collector'

    def test_inventory_item_filtering(self, api_client, user, client_id):
        """Test filtering inventory items"""
        api_client.force_authenticate(user=user)
        
        # Create items with different statuses
        category = baker.make(Category, client_id=client_id)
        item1 = baker.make(InventoryItem, status='in_store', category=category, client_id=client_id)
        item2 = baker.make(InventoryItem, status='sold', category=category, client_id=client_id)
        
        # Filter by status
        response = api_client.get('/api/v1/inventory_items/?status=in_store')
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['status'] == 'in_store'

    def test_inventory_item_search(self, api_client, user, inventory_item):
        """Test searching inventory items"""
        api_client.force_authenticate(user=user)
        
        response = api_client.get('/api/v1/inventory_items/?search=Test')
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_bulk_status_update(self, api_client, user, client_id):
        """Test bulk status update endpoint"""
        api_client.force_authenticate(user=user)
        
        # Create multiple items
        category = baker.make(Category, client_id=client_id)
        item1 = baker.make(InventoryItem, status='in_store', category=category, client_id=client_id)
        item2 = baker.make(InventoryItem, status='in_store', category=category, client_id=client_id)
        
        data = {
            'item_ids': [str(item1.id), str(item2.id)],
            'status': 'consigned',
            'notes': 'Bulk consignment'
        }
        
        response = api_client.post(
            '/api/v1/inventory_items/bulk_update_status/',
            data,
            format='json'
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['updated_count'] == 2
        
        # Verify items were updated
        item1.refresh_from_db()
        item2.refresh_from_db()
        assert item1.status == 'consigned'
        assert item2.status == 'consigned'

    def test_inventory_stats(self, api_client, user, client_id):
        """Test inventory statistics endpoint"""
        api_client.force_authenticate(user=user)
        
        # Create items with different statuses
        category = baker.make(Category, client_id=client_id)
        baker.make(InventoryItem, status='in_store', category=category, client_id=client_id, price=100)
        baker.make(InventoryItem, status='sold', category=category, client_id=client_id, price=200)
        baker.make(InventoryItem, status='consigned', category=category, client_id=client_id, price=150, is_consigned=True)
        
        response = api_client.get(f'/api/v1/inventory_items/stats/?client_id={client_id}')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_items'] == 3
        assert response.data['total_value'] == 450  # 100 + 200 + 150
        assert response.data['consigned_items'] == 1
        assert 'by_status' in response.data
        assert 'by_category' in response.data


@pytest.mark.django_db
class TestCategoryAPI:
    def test_category_tree(self, api_client, user, client_id):
        """Test category tree endpoint"""
        api_client.force_authenticate(user=user)
        
        # Create hierarchical categories
        parent = baker.make(Category, name='Collectibles', client_id=client_id)
        child1 = baker.make(Category, name='Coins', parent=parent, client_id=client_id)
        child2 = baker.make(Category, name='Stamps', parent=parent, client_id=client_id)
        
        response = api_client.get(f'/api/v1/categories/tree/?client_id={client_id}')
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1  # One root category
        assert response.data[0]['name'] == 'Collectibles'
        assert len(response.data[0]['children']) == 2

    def test_category_items(self, api_client, user, category, client_id):
        """Test getting items for a category"""
        api_client.force_authenticate(user=user)
        
        # Create items in the category
        baker.make(InventoryItem, category=category, client_id=client_id, _quantity=3)
        
        response = api_client.get(f'/api/v1/categories/{category.id}/items/')
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3


@pytest.mark.django_db
class TestLocationAPI:
    def test_location_tree(self, api_client, user, client_id):
        """Test location tree endpoint"""
        api_client.force_authenticate(user=user)
        
        # Create hierarchical locations
        building = baker.make(Location, name='Main Building', type='building', client_id=client_id)
        room = baker.make(Location, name='Storage Room', type='room', parent=building, client_id=client_id)
        
        response = api_client.get(f'/api/v1/locations/tree/?client_id={client_id}')
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1  # One root location
        assert response.data[0]['name'] == 'Main Building'
        assert len(response.data[0]['children']) == 1


@pytest.mark.django_db
class TestValidation:
    def test_coin_category_validation(self, api_client, user, client_id):
        """Test category-specific validation for coins"""
        api_client.force_authenticate(user=user)
        
        category = baker.make(Category, name='Coins', client_id=client_id)
        
        # Missing required fields for coins
        data = {
            'name': 'Test Coin',
            'category': str(category.id),
            'price': '100.00',
            'client_id': str(client_id),
            'attributes': {
                'year': 2021  # Missing cert_number and grade
            }
        }
        
        response = api_client.post('/api/v1/inventory_items/', data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'cert_number' in str(response.data)

    def test_price_validation(self, api_client, user, category, client_id):
        """Test price validation"""
        api_client.force_authenticate(user=user)
        
        data = {
            'name': 'Test Item',
            'category': str(category.id),
            'price': '-100.00',  # Negative price
            'client_id': str(client_id)
        }
        
        response = api_client.post('/api/v1/inventory_items/', data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'positive' in str(response.data)

    def test_weight_validation(self, api_client, user, category, client_id):
        """Test weight/weight_unit validation"""
        api_client.force_authenticate(user=user)
        
        data = {
            'name': 'Test Item',
            'category': str(category.id),
            'price': '100.00',
            'weight': '10.5',  # Weight without unit
            'client_id': str(client_id)
        }
        
        response = api_client.post('/api/v1/inventory_items/', data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'weight unit' in str(response.data)