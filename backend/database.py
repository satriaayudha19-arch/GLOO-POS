import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger(__name__)
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
db = client[os.environ["DB_NAME"]]


async def run_with_database_retry(operation, operation_name="database operation", max_attempts=6, initial_delay=2.0, max_delay=30.0):
    delay = initial_delay
    for attempt in range(1, max_attempts + 1):
        try:
            await db.command("ping")
            return await operation()
        except PyMongoError:
            if attempt == max_attempts:
                logger.exception("MongoDB %s failed after %s attempts", operation_name, max_attempts)
                raise
            logger.warning(
                "MongoDB %s attempt %s/%s failed; retrying in %.1f seconds",
                operation_name,
                attempt,
                max_attempts,
                delay,
                exc_info=True,
            )
            await asyncio.sleep(delay)
            delay = min(delay * 2, max_delay)
