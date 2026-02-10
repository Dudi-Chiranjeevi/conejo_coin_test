import os
from dotenv import load_dotenv
import subprocess

# Load the .env file
load_dotenv(dotenv_path=".env")

GCLOUD_PATH = r'C:\Users\MadhuriPothapragada\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'


# Build the gcloud command
cmd = [
    GCLOUD_PATH, "run", "deploy", "coenjo-backend",
    "--image", "gcr.io/swift-implement-405417/coenjo-backend-image",
    "--platform", "managed",
    "--region", "us-central1",
    "--allow-unauthenticated",
    "--add-cloudsql-instances", "swift-implement-405417:us-central1:coenjo-postgres",
    "--set-env-vars",
    ",".join([
        f"DEBUG={os.getenv('DEBUG', 'True')}",
        f"ALLOWED_HOSTS={os.getenv('ALLOWED_HOSTS', '*')}",
        f"DB_NAME={os.getenv('DB_NAME')}",
        f"DB_USER={os.getenv('DB_USER')}",
        f"DB_PASSWORD={os.getenv('DB_PASSWORD')}",
        f"DB_USE_SSL={os.getenv('DB_USE_SSL', 'True')}",
        f"FIREBASE_API_KEY={os.getenv('FIREBASE_API_KEY')}",
        f"FIREBASE_AUTH_DOMAIN={os.getenv('FIREBASE_AUTH_DOMAIN')}",
        f"FIREBASE_PROJECT_ID={os.getenv('FIREBASE_PROJECT_ID')}",
        f"FIREBASE_STORAGE_BUCKET={os.getenv('FIREBASE_STORAGE_BUCKET')}",
        f"FIREBASE_MESSAGING_SENDER_ID={os.getenv('FIREBASE_MESSAGING_SENDER_ID')}",
        f"FIREBASE_APP_ID={os.getenv('FIREBASE_APP_ID')}",
        f"SECRET_KEY={os.getenv('SECRET_KEY')}"
    ])
]

# Run the command with current environment
subprocess.run(cmd, env=os.environ.copy())
