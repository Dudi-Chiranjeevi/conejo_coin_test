from django.db import models
from pgvector.django import VectorField

class Conversation(models.Model):
    title = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

class Message(models.Model):
    convo = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=16)  # "user" | "assistant" | "system"
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class FAQSQLCache(models.Model):
    question = models.TextField(unique=True)
    sql = models.TextField()
    embedding = VectorField(dimensions=384)  # MiniLM family => 384 dims
    category = models.CharField(max_length=100, blank=True, default="")
    usepie = models.BooleanField(default=False)
    usebar = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
