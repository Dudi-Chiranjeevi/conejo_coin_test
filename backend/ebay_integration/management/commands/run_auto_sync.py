# NEW FILE: ebay_integration/management/commands/run_auto_sync.py
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from ebay_integration.models import EbaySettings
from ebay_integration.ebay_service import EbayService

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Run eBay auto sync to automatically create listings for unlisted inventory items'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force run auto sync even if interval has not passed',
        )

    def handle(self, *args, **options):
        force_run = options['force']
        
        self.stdout.write("🔄 Starting eBay Auto Sync...")
        
        try:
            # Get settings
            settings_obj, _ = EbaySettings.objects.get_or_create(id=1)
            
            # Check if auto sync is enabled
            if not settings_obj.auto_sync_enabled and not force_run:
                self.stdout.write(
                    self.style.WARNING("⚠️ Auto sync is disabled in settings. Use --force to run anyway.")
                )
                return
            
            # Check if we should run based on interval
            if not self.should_run_sync(settings_obj) and not force_run:
                self.stdout.write(
                    self.style.WARNING("⏰ Sync interval not reached yet. Use --force to run anyway.")
                )
                return
            
            self.stdout.write(f"✅ Auto sync enabled: {settings_obj.auto_sync_enabled}")
            self.stdout.write(f"⏰ Sync interval: {settings_obj.sync_interval} minutes")
            self.stdout.write(f"🔍 Looking for unlisted inventory items...")
            
            # Run auto sync
            ebay_service = EbayService(sandbox=True, request=None)
            result = ebay_service.auto_sync_listings()
            
            # Update last sync run time
            settings_obj.last_sync_run = timezone.now()
            settings_obj.save()
            
            if result['success']:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✅ Auto sync completed successfully! "
                        f"Processed: {result['processed']}/{result['total_found']} items"
                    )
                )
                
                # Show successful listings
                if result.get('successful_listings'):
                    self.stdout.write("📦 Successfully listed items:")
                    for listing in result['successful_listings']:
                        self.stdout.write(f"   ✅ {listing['name']} (SKU: {listing['sku']})")
                
                # Show errors
                if result.get('errors'):
                    self.stdout.write(self.style.ERROR("❌ Errors encountered:"))
                    for error in result['errors']:
                        self.stdout.write(f"   ❌ {error}")
                        
            else:
                self.stdout.write(
                    self.style.ERROR(f"❌ Auto sync failed: {result.get('error')}")
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"💥 Auto sync command failed: {str(e)}")
            )
            logger.error(f"Auto sync command error: {str(e)}", exc_info=True)

    def should_run_sync(self, settings_obj):
        """Check if auto sync should run based on interval"""
        if not settings_obj.last_sync_run:
            return True
        
        interval_minutes = settings_obj.sync_interval
        next_run = settings_obj.last_sync_run + timedelta(minutes=interval_minutes)
        return timezone.now() >= next_run