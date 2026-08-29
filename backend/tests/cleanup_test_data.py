"""Remove QA-created test data (ideas/users) from MongoDB."""
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    r1 = await db.ideas.delete_many({"title": {"$regex": "^TEST_"}})
    r2 = await db.users.delete_many({"username": {"$regex": "^(TEST_user|qa[0-9]+)"}})
    print("ideas deleted:", r1.deleted_count, "users deleted:", r2.deleted_count)
    print("ideas left:", await db.ideas.count_documents({}))
    client.close()


asyncio.run(main())
