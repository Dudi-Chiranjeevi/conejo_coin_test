from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from .models import InventoryItem, StatusHistory
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def create_auth_token(sender, instance=None, created=False, **kwargs):
    """Create authentication token for new users"""
    if created:
        Token.objects.create(user=instance)
        logger.info(f"Created authentication token for user: {instance.username}")


@receiver(pre_save, sender=InventoryItem)
def track_status_change(sender, instance, **kwargs):
    """Track status changes for inventory items"""
    if instance.pk:  # Only for existing items
        try:
            previous = InventoryItem.objects.get(pk=instance.pk)
            instance._previous_status = previous.status
        except InventoryItem.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=InventoryItem)
def create_status_history(sender, instance, created, **kwargs):
    """Create status history entry when item status changes"""
    if created:
        # Create initial status history for new items
        StatusHistory.objects.create(
            item=instance,
            old_status='',
            new_status=instance.status,
            user=getattr(instance, '_created_by', None),
            notes='Item created'
        )
        logger.info(f"Created initial status history for item: {instance.name}")
    
    elif hasattr(instance, '_previous_status') and instance._previous_status:
        # Check if status actually changed
        if instance._previous_status != instance.status:
            StatusHistory.objects.create(
                item=instance,
                old_status=instance._previous_status,
                new_status=instance.status,
                user=getattr(instance, '_modified_by', None),
                notes=getattr(instance, '_status_change_notes', 'Status updated')
            )
            logger.info(
                f"Status changed for item {instance.name}: "
                f"{instance._previous_status} -> {instance.status}"
            )


# Import this in your apps.py ready() method
def connect_signals():
    """Connect all signals - call this from apps.py ready() method"""
    logger.info("Connected inventory signals")