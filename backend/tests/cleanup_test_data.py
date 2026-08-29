"""Remove QA-created test data (users, ideas, challenges, tournaments) from MongoDB."""
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

USER_RE = "^TEST"
TITLE_RE = "^TEST"


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    users = await db.users.find({"username": {"$regex": USER_RE}}, {"id": 1}).to_list(2000)
    uids = [u["id"] for u in users]
    print("qa users:", len(uids))

    for coll, field in [("quiz_attempts", "user_id"), ("activity_results", "user_id"),
                        ("tournament_entries", "student_id"), ("challenge_completions", "student_id"),
                        ("certificates", "student_id"), ("ideas", "author_id"),
                        ("idea_comments", "author_id")]:
        r = await db[coll].delete_many({field: {"$in": uids}})
        print(f"{coll}: {r.deleted_count}")
    r = await db.messages.delete_many({"$or": [{"sender_id": {"$in": uids}}, {"recipient_id": {"$in": uids}}]})
    print("messages:", r.deleted_count)

    for coll in ("ideas", "challenges", "tournaments"):
        r = await db[coll].delete_many({"title": {"$regex": TITLE_RE}})
        print(f"{coll} by title: {r.deleted_count}")
    r = await db.idea_comments.delete_many({"text": {"$regex": TITLE_RE}})
    print("comments by text:", r.deleted_count)
    r = await db.messages.delete_many({"text": {"$regex": TITLE_RE}})
    print("messages by text:", r.deleted_count)

    r = await db.users.update_many({"teacher_id": {"$in": uids}},
                                   {"$set": {"teacher_id": None, "teacher_name": None}})
    print("students detached from qa teachers:", r.modified_count)
    r = await db.users.delete_many({"username": {"$regex": USER_RE}})
    print("users deleted:", r.deleted_count)

    print("remaining users:", await db.users.count_documents({}))
    print("remaining ideas:", await db.ideas.count_documents({}))
    print("remaining tournaments:", await db.tournaments.count_documents({}))
    print("remaining challenges:", await db.challenges.count_documents({}))
    client.close()


asyncio.run(main())
