# FAQ-Based RAG System Documentation

This document explains the FAQ-based Retrieval Augmented Generation (RAG) system implemented for the AI Assistant in the CoenJo project.

## Overview

The FAQ-based RAG system enhances the AI Assistant by storing common questions and their corresponding SQL queries in a vector database. When users ask questions, the system:

1. Converts the question into an embedding vector
2. Searches for similar questions in the database
3. Returns the pre-computed SQL if a close match is found
4. Falls back to OpenAI for SQL generation if no match is found
5. Automatically stores new questions and generated SQL for future use

This approach offers several advantages:
- **Faster responses** for common questions
- **Consistent answers** to similar questions
- **Reduced API costs** by minimizing calls to OpenAI
- **Continuous improvement** as the system learns from new questions

## System Components

### Backend Components

1. **FAQSQLCache Model**: Django model that stores questions, SQL queries, and vector embeddings
2. **Embeddings Module**: Uses SentenceTransformers to generate vector embeddings
3. **FAQ Manager**: Handles FAQ storage, retrieval, and similarity search
4. **API Endpoints**: REST endpoints for CRUD operations on FAQs

### Frontend Components

1. **FAQ Manager Interface**: Admin interface for managing FAQs
2. **AI Service**: Client-side functions for interacting with the FAQ API
3. **API Routes**: Next.js API routes that connect to the backend

## Setup Instructions

### Environment Variables

Add these to your `.env` file:

```
# Optional: Choose which embedding model to use
EMBEDDING_MODEL=all-MiniLM-L6-v2  # Default
# EMBEDDING_MODEL=paraphrase-MiniLM-L3-v2  # Smaller/faster
# EMBEDDING_MODEL=all-MiniLM-L12-v2  # Larger/more accurate

# Required for OpenAI fallback
OPENAI_API_KEY=your_openai_api_key
```

### Database Migration

Run the following commands to create the necessary database tables:

```bash
python manage.py makemigrations
python manage.py migrate
```

### Initialize FAQs

Populate the database with initial FAQs:

```bash
python manage.py init_faqs
```

Or provide a custom JSON file:

```bash
python manage.py init_faqs --file path/to/your/faqs.json
```

## Usage

### Querying the System

The system is automatically used when calling the `askSQL` function:

```typescript
import { askSQL } from "@/lib/ai";

// This will check the FAQ database first before falling back to OpenAI
const sql = await askSQL("How many items do we have in inventory?");
```

### Managing FAQs

Administrators can manage FAQs through the FAQ Manager interface in the AI Assistant page. This interface allows:

- Viewing all stored FAQs
- Adding new FAQs manually
- Editing existing FAQs
- Deleting FAQs
- Searching for FAQs by semantic similarity

### API Reference

#### Backend Endpoints

- `GET /api/v1/ai/faqs` - List all FAQs (optional `?category=inventory` filter)
- `POST /api/v1/ai/faqs` - Create a new FAQ
- `GET /api/v1/ai/faqs/{id}` - Get a specific FAQ
- `PUT /api/v1/ai/faqs/{id}` - Update a specific FAQ
- `DELETE /api/v1/ai/faqs/{id}` - Delete a specific FAQ
- `POST /api/v1/ai/faqs/query` - Query FAQs by semantic similarity

#### Frontend Functions

```typescript
// Get all FAQs
const faqs = await getFAQs(category?: string);

// Query FAQs by semantic similarity
const similarFaqs = await queryFAQs(query: string, category?: string, limit?: number);

// Create a new FAQ
const newFaq = await createFAQ({ question, sql, category });

// Update an existing FAQ
const updatedFaq = await updateFAQ(id, { question?, sql?, category? });

// Delete a FAQ
await deleteFAQ(id);
```

## Advanced Configuration

### Similarity Threshold

The system uses a similarity threshold to determine when to use a cached FAQ. This can be adjusted in `faq_manager.py`:

```python
# Lower values = more strict matching (fewer cache hits)
# Higher values = more lenient matching (more cache hits)
CACHE_HIT_DISTANCE = 0.15  # Default
```

### Embedding Models

You can change the embedding model by setting the `EMBEDDING_MODEL` environment variable. Available options:

- `all-MiniLM-L6-v2` (default, ~22M parameters)
- `paraphrase-MiniLM-L3-v2` (smaller, ~16M parameters)
- `all-MiniLM-L12-v2` (larger, ~33M parameters)

## Troubleshooting

### Common Issues

1. **No FAQs found**: Ensure you've run the `init_faqs` management command
2. **Poor matching quality**: Try adjusting the `CACHE_HIT_DISTANCE` threshold
3. **Slow performance**: Consider using a smaller embedding model

### Debugging

Enable debug logging to see more information about the matching process:

```python
# In settings.py
LOGGING = {
    'version': 1,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'assistant.faq_manager': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

## Future Enhancements

1. **Bulk Import/Export**: Add functionality to import/export FAQs in bulk
2. **Feedback Mechanism**: Allow users to rate the quality of SQL responses
3. **Automatic Clustering**: Group similar questions to improve organization
4. **Multi-language Support**: Add support for questions in multiple languages
