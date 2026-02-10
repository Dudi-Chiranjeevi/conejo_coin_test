from sentence_transformers import SentenceTransformer
from functools import lru_cache
from typing import List, Union
import os

# Model options with different parameter sizes
DEFAULT_MODEL = "all-MiniLM-L6-v2"        # ~22M parameters (good default)
SMALLER_MODEL = "paraphrase-MiniLM-L3-v2" # ~16M parameters (faster)
LARGER_MODEL = "all-MiniLM-L12-v2"        # ~33M parameters (more accurate)

# Use environment variables to control model + auth
MODEL_NAME = os.getenv("EMBEDDING_MODEL", DEFAULT_MODEL)
HF_TOKEN = os.getenv("HF_TOKEN", "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")

@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Get or create the embedding model with lazy loading
    
    Returns:
        SentenceTransformer: The embedding model
    """
    print(f"Loading embedding model: {MODEL_NAME}")
    kwargs = {}
    if HF_TOKEN:
        kwargs["use_auth_token"] = HF_TOKEN
    return SentenceTransformer(MODEL_NAME, **kwargs)

def embed(text: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
    """Generate embeddings for text using the sentence transformer model
    
    Args:
        text: Single string or list of strings to embed
        
    Returns:
        For single string: List of floats representing the embedding vector
        For list of strings: List of embedding vectors
    """
    model = _get_model()
    
    if isinstance(text, str):
        return model.encode([text])[0].tolist()
    else:
        return model.encode(text).tolist()