from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [("assistant", "0001_initial")]
    operations = [
        migrations.RunSQL("""
            CREATE INDEX IF NOT EXISTS faqs_emb_ivfflat
            ON assistant_faqsqlcache
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        """)
    ]
