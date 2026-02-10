from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Count, Sum
from .models import Category, Location, InventoryItem, StatusHistory
from django.utils.html import format_html


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'parent', 'client_id', 'item_count', 'created_at']
    list_filter = ['client_id', 'created_at', 'parent']
    search_fields = ['name', 'client_id']
    ordering = ['name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        (None, {
            'fields': ('name', 'parent', 'client_id')
        }),
        ('Custom Fields', {
            'fields': ('custom_fields',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def item_count(self, obj):
        """Show count of items in this category"""
        count = InventoryItem.objects.filter(category=obj).count()
        if count > 0:
            url = reverse('admin:inventory_inventoryitem_changelist') + f'?category__id__exact={obj.id}'
            return format_html('<a href="{}">{} items</a>', url, count)
        return '0 items'
    item_count.short_description = 'Items'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('parent')


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'parent', 'client_id', 'item_count', 'created_at']
    list_filter = ['type', 'client_id', 'created_at', 'parent']
    search_fields = ['name', 'client_id']
    ordering = ['name']
    readonly_fields = ['id', 'created_at', 'updated_at']

    fieldsets = (
        (None, {
            'fields': ('name', 'type', 'parent', 'client_id')
        }),
        ('Metadata', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def item_count(self, obj):
        """Show count of items at this location"""
        count = InventoryItem.objects.filter(location=obj).count()
        if count > 0:
            url = reverse('admin:inventory_inventoryitem_changelist') + f'?location__id__exact={obj.id}'
            return format_html('<a href="{}">{} items</a>', url, count)
        return '0 items'
    item_count.short_description = 'Items'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('parent')


class StatusHistoryInline(admin.TabularInline):
    model = StatusHistory
    extra = 0
    readonly_fields = ['timestamp']
    fields = ['old_status', 'new_status', 'timestamp', 'user', 'notes']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'category', 'status', 'price', 'location', 
        'is_consigned', 'date_added', 'thumbnail_preview'
    ]
    list_filter = [
        'status', 'category', 'location', 'is_consigned', 
        'date_added', 'client_id', 'weight_unit'
    ]
    search_fields = ['name', 'description', 'notes']
    ordering = ['-date_added']
    readonly_fields = ['id', 'date_added', 'updated_at', 'thumbnail_preview']
    inlines = [StatusHistoryInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'category', 'client_id')
        }),
        ('Status & Location', {
            'fields': ('status', 'location', 'is_consigned')
        }),
        ('Financial', {
            'fields': ('price',)
        }),
        ('Physical Properties', {
            'fields': ('weight', 'weight_unit'),
        }),
        ('Images', {
            'fields': ('thumbnail', 'thumbnail_preview', 'images'),
            'classes': ('collapse',)
        }),
        ('Category Attributes', {
            'fields': ('attributes',),
            'classes': ('collapse',)
        }),
        ('Additional Info', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('id', 'date_added', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def thumbnail_preview(self, obj):
        """Show thumbnail image preview"""
        if obj.thumbnail:
            return format_html(
                '<img src="{}" width="100" height="100" style="object-fit: cover;" />',
                obj.thumbnail
            )
        return 'No image'
    thumbnail_preview.short_description = 'Preview'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('category', 'location')

    actions = ['mark_as_sold', 'mark_as_consigned', 'mark_as_in_store']

    def mark_as_sold(self, request, queryset):
        """Bulk action to mark items as sold"""
        count = queryset.update(status='sold')
        
        # Create status history entries
        for item in queryset:
            StatusHistory.objects.create(
                item=item,
                old_status=item.status,
                new_status='sold',
                user=request.user,
                notes='Bulk updated via admin'
            )
        
        self.message_user(request, f'{count} items marked as sold.')
    mark_as_sold.short_description = 'Mark selected items as sold'

    def mark_as_consigned(self, request, queryset):
        """Bulk action to mark items as consigned"""
        count = queryset.update(status='consigned', is_consigned=True)
        
        for item in queryset:
            StatusHistory.objects.create(
                item=item,
                old_status=item.status,
                new_status='consigned',
                user=request.user,
                notes='Bulk updated via admin'
            )
        
        self.message_user(request, f'{count} items marked as consigned.')
    mark_as_consigned.short_description = 'Mark selected items as consigned'

    def mark_as_in_store(self, request, queryset):
        """Bulk action to mark items as in store"""
        count = queryset.update(status='in_store', is_consigned=False)
        
        for item in queryset:
            StatusHistory.objects.create(
                item=item,
                old_status=item.status,
                new_status='in_store',
                user=request.user,
                notes='Bulk updated via admin'
            )
        
        self.message_user(request, f'{count} items marked as in store.')
    mark_as_in_store.short_description = 'Mark selected items as in store'


@admin.register(StatusHistory)
class StatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['item_name', 'old_status', 'new_status', 'timestamp', 'user']
    list_filter = ['old_status', 'new_status', 'timestamp', 'user']
    search_fields = ['item__name', 'notes']
    readonly_fields = ['id', 'timestamp']
    ordering = ['-timestamp']

    def item_name(self, obj):
        """Show item name with link"""
        url = reverse('admin:inventory_inventoryitem_change', args=[obj.item.pk])
        return format_html('<a href="{}">{}</a>', url, obj.item.name)
    item_name.short_description = 'Item'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('item', 'user')

    def has_add_permission(self, request):
        """Disable manual creation of status history"""
        return False

    def has_change_permission(self, request, obj=None):
        """Make status history read-only"""
        return False


# Customize admin site headers
admin.site.site_header = "Conejo Coin Inventory Management"
admin.site.site_title = "Conejo Coin Admin"
admin.site.index_title = "Inventory Management Dashboard"