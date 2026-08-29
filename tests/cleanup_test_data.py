"""Remove TEST_ regression artifacts created by the frontend regression run (iteration 7)."""
import asyncio
import os

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

env = dotenv_values("/app/backend/.env")
MONGO_URL = os.environ.get("MONGO_URL") or env["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME") or env["DB_NAME"]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    for coll in ["ideas", "daily_challenges", "challenges", "tournaments", "announcements"]:
        res = await db[coll].delete_many({"title": {"$regex": "^TEST_Regression"}})
        print(coll, "deleted:", res.deleted_count)
    client.close()


asyncio.run(main())
