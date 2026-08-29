from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import time
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone, date
import jwt
import bcrypt as bcrypt_lib

from seed_data import QUIZZES, ACTIVITIES, CONTENT_ITEMS, DEMO_IDEAS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SECRET_KEY = os.environ['JWT_SECRET_KEY']
TEACHER_SIGNUP_CODE = os.environ['TEACHER_SIGNUP_CODE']
SEED_DEMO_ACCOUNTS = os.environ.get('SEED_DEMO_ACCOUNTS', 'false').lower() == 'true'
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

SUBJECTS = ["Science", "Technology", "Engineering", "Arts", "Mathematics"]
AGE_GROUPS = ["13-15", "16-18", "18+"]
ACTIVITY_POINTS = 50
TOURNAMENT_POINTS = 30
TOURNAMENT_WIN_BONUS = 100
VERIFY_MIN_STUDENTS = 2
VERIFY_MIN_CHALLENGES = 3

app = FastAPI(title="STEAM Education Platform API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# ---------------- Models ----------------
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    full_name: str
    role: str = "student"
    age: Optional[int] = None
    age_group: Optional[str] = None
    teacher_id: Optional[str] = None
    teacher_name: Optional[str] = None
    verified: bool = False
    points: int = 0
    streak_days: int = 0
    last_active: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: str
    role: str = "student"
    age: Optional[int] = None
    teacher_code: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class Quiz(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    subject: str = "General"
    age_groups: List[str] = ["all"]
    questions: List[dict]
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IdeaShare(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str
    author_id: str
    author_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    likes: int = 0
    liked_by: List[str] = []


class IdeaShareCreate(BaseModel):
    title: str
    description: str
    category: str


class CommentCreate(BaseModel):
    text: str


class Activity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    type: str
    content: dict
    difficulty: str
    subject: str
    age_groups: List[str] = ["all"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ActivityCompletion(BaseModel):
    score: int


class MessageCreate(BaseModel):
    recipient_id: str
    text: str


class ChallengeCreate(BaseModel):
    title: str
    description: str = ""
    type: str  # "quiz" | "task"
    quiz_id: Optional[str] = None
    points: int = 20


class AnnouncementCreate(BaseModel):
    title: str
    body: str


class TournamentCreate(BaseModel):
    title: str
    description: str = ""
    subject: str
    age_group: str = "all"  # "all" | "13-15" | "16-18" | "18+"
    scope: str = "open"  # "open" | "class"
    quiz_id: str
    duration_days: int = 7


# ---------------- Utils ----------------
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')[:72]
    return bcrypt_lib.hashpw(password_bytes, bcrypt_lib.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode('utf-8')[:72]
    return bcrypt_lib.checkpw(password_bytes, hashed_password.encode('utf-8'))


def age_to_group(age: int) -> str:
    if age <= 15:
        return "13-15"
    if age <= 18:
        return "16-18"
    return "18+"


def safe_user(u: dict) -> dict:
    return {
        "id": u["id"], "username": u["username"], "full_name": u["full_name"],
        "role": u.get("role", "student"), "age_group": u.get("age_group"),
        "verified": u.get("verified", False), "teacher_id": u.get("teacher_id"),
        "points": u.get("points", 0), "streak_days": u.get("streak_days", 0),
    }


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        user = await db.users.find_one({"username": username})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")


async def require_teacher(current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    return current_user


async def award_points(user_id: str, pts: int, reason: str = "general"):
    if pts:
        await db.users.update_one({"id": user_id}, {"$inc": {"points": pts}})
        await db.point_events.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "points": pts, "reason": reason,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


async def touch_streak(user_id: str) -> int:
    u = await db.users.find_one({"id": user_id})
    today = date.today().isoformat()
    if u.get("last_active") == today:
        return u.get("streak_days", 0)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    streak = (u.get("streak_days", 0) + 1) if u.get("last_active") == yesterday else 1
    await db.users.update_one({"id": user_id}, {"$set": {"streak_days": streak, "last_active": today}})
    return streak


async def check_teacher_verification(teacher_id: str):
    students = await db.users.count_documents({"teacher_id": teacher_id})
    challenges = await db.challenges.count_documents({"teacher_id": teacher_id})
    if students >= VERIFY_MIN_STUDENTS and challenges >= VERIFY_MIN_CHALLENGES:
        await db.users.update_one({"id": teacher_id, "verified": False}, {"$set": {"verified": True}})


# ---------------- Badges ----------------
BADGE_DEFS = [
    {"key": "first_quiz", "name": "First Quiz", "description": "Complete your first quiz",
     "icon": "BookCheck", "metric": "quizzes", "goal": 1, "color": "emerald"},
    {"key": "ten_quizzes", "name": "Quiz Machine", "description": "Complete 10 different quizzes",
     "icon": "Layers", "metric": "quizzes", "goal": 10, "color": "teal"},
    {"key": "perfect_score", "name": "Perfect Score", "description": "Score 100% on any quiz",
     "icon": "Target", "metric": "best_score", "goal": 100, "color": "rose"},
    {"key": "first_activity", "name": "Hands On", "description": "Finish your first interactive activity",
     "icon": "Puzzle", "metric": "activities", "goal": 1, "color": "purple"},
    {"key": "streak_7", "name": "7 Day Streak", "description": "Stay active 7 days in a row",
     "icon": "Flame", "metric": "streak", "goal": 7, "color": "orange"},
    {"key": "streak_30", "name": "30 Day Streak", "description": "Stay active 30 days in a row",
     "icon": "CalendarCheck", "metric": "streak", "goal": 30, "color": "red"},
    {"key": "points_100", "name": "100 Points", "description": "Earn your first 100 points",
     "icon": "Star", "metric": "points", "goal": 100, "color": "yellow"},
    {"key": "points_500", "name": "500 Points", "description": "Earn 500 points in total",
     "icon": "Sparkles", "metric": "points", "goal": 500, "color": "amber"},
    {"key": "points_1000", "name": "1000 Points", "description": "Earn 1000 points in total",
     "icon": "Crown", "metric": "points", "goal": 1000, "color": "indigo"},
    {"key": "first_idea", "name": "Idea Spark", "description": "Share your first idea with the community",
     "icon": "Lightbulb", "metric": "ideas", "goal": 1, "color": "lime"},
    {"key": "teachers_pick", "name": "Teacher's Pick", "description": "Get one of your ideas spotlighted by a teacher",
     "icon": "BadgeCheck", "metric": "spotlights", "goal": 1, "color": "sky"},
    {"key": "contest_champion", "name": "Contest Champion", "description": "Win a contest and earn a certificate",
     "icon": "Trophy", "metric": "certificates", "goal": 1, "color": "amber"},
]


async def _badge_metrics(user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id})
    attempts = await db.quiz_attempts.find({"user_id": user_id}, {"_id": 0, "quiz_id": 1, "score": 1}).to_list(2000)
    results = await db.activity_results.find({"user_id": user_id}, {"_id": 0, "activity_id": 1}).to_list(2000)
    ideas = await db.ideas.find({"author_id": user_id}, {"_id": 0, "spotlight": 1}).to_list(500)
    certificates = await db.certificates.count_documents({"student_id": user_id})
    return {
        "quizzes": len({a["quiz_id"] for a in attempts}),
        "best_score": max([a["score"] for a in attempts], default=0),
        "activities": len({r["activity_id"] for r in results}),
        "streak": (user or {}).get("streak_days", 0),
        "points": (user or {}).get("points", 0),
        "ideas": len(ideas),
        "spotlights": len([i for i in ideas if i.get("spotlight")]),
        "certificates": certificates,
    }


async def evaluate_badges(user_id: str) -> List[dict]:
    """Awards any newly earned badges and returns the new ones."""
    metrics = await _badge_metrics(user_id)
    earned_keys = {b["key"] for b in await db.user_badges.find({"user_id": user_id}, {"_id": 0, "key": 1}).to_list(100)}
    new_badges = []
    for d in BADGE_DEFS:
        if d["key"] in earned_keys:
            continue
        if metrics.get(d["metric"], 0) >= d["goal"]:
            await db.user_badges.insert_one({
                "id": str(uuid.uuid4()), "user_id": user_id, "key": d["key"],
                "earned_at": datetime.now(timezone.utc).isoformat(),
            })
            new_badges.append({"key": d["key"], "name": d["name"], "description": d["description"],
                               "icon": d["icon"], "color": d["color"]})
    return new_badges


def age_group_query(age_group: Optional[str]) -> dict:
    if age_group and age_group != "all":
        return {"age_groups": {"$in": [age_group, "all"]}}
    return {}


# ---------------- Rate limiting (in-memory sliding window) ----------------
_rate_buckets = {}


def _rate_limit(key: str, max_events: int, window_seconds: int) -> bool:
    now = time.time()
    events = [t for t in _rate_buckets.get(key, []) if now - t < window_seconds]
    if len(events) >= max_events:
        _rate_buckets[key] = events
        return False
    events.append(now)
    _rate_buckets[key] = events
    return True


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


# ---------------- Auth ----------------
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate, request: Request):
    if not _rate_limit(f"reg:{_client_ip(request)}", 50, 600):
        raise HTTPException(status_code=429, detail="Too many registration attempts. Please try again later.")
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
    if user_data.role not in ("student", "teacher"):
        raise HTTPException(status_code=400, detail="Role must be 'student' or 'teacher'")
    if user_data.role == "teacher":
        if user_data.teacher_code != TEACHER_SIGNUP_CODE:
            raise HTTPException(status_code=403, detail="Invalid teacher signup code")
    else:
        if user_data.age is None or user_data.age < 10 or user_data.age > 100:
            raise HTTPException(status_code=400, detail="Students must provide an age between 10 and 100")

    existing = await db.users.find_one({"$or": [{"email": user_data.email}, {"username": user_data.username}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already registered")

    user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        role=user_data.role,
        age=user_data.age if user_data.role == "student" else None,
        age_group=age_to_group(user_data.age) if user_data.role == "student" else None,
    )
    user_dict = user.dict()
    user_dict["password"] = hash_password(user_data.password)
    await db.users.insert_one(user_dict)
    return user


@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin, request: Request):
    fail_key = f"login:{_client_ip(request)}:{user_data.username.lower()}"
    now = time.time()
    recent_failures = [t for t in _rate_buckets.get(fail_key, []) if now - t < 300]
    if len(recent_failures) >= 5:
        raise HTTPException(status_code=429, detail="Too many failed login attempts. Please try again in a few minutes.")
    user = await db.users.find_one({"username": user_data.username})
    if not user or not verify_password(user_data.password, user["password"]):
        recent_failures.append(now)
        _rate_buckets[fail_key] = recent_failures
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _rate_buckets.pop(fail_key, None)
    return Token(access_token=create_access_token({"sub": user["username"]}), token_type="bearer")


@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


# ---------------- Quizzes ----------------
def _strip_correct_answers(quiz: dict) -> dict:
    q = dict(quiz)
    q["questions"] = [
        {k: v for k, v in question.items() if k != "correct_answer"}
        for question in quiz.get("questions", [])
    ]
    return q


@api_router.get("/quizzes", response_model=List[Quiz])
async def get_quizzes(subject: Optional[str] = None, age_group: Optional[str] = None):
    query = age_group_query(age_group)
    if subject:
        query["subject"] = subject
    quizzes = await db.quizzes.find(query).to_list(200)
    return [Quiz(**_strip_correct_answers(q)) for q in quizzes]


@api_router.get("/quizzes/{quiz_id}", response_model=Quiz)
async def get_quiz(quiz_id: str):
    quiz = await db.quizzes.find_one({"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return Quiz(**_strip_correct_answers(quiz))


def _grade(quiz: dict, answers: list) -> int:
    correct = 0
    total = len(quiz["questions"])
    for i, answer in enumerate(answers):
        if i < total and answer.get("selected") == quiz["questions"][i].get("correct_answer"):
            correct += 1
    return int((correct / total) * 100) if total else 0


@api_router.post("/quizzes/{quiz_id}/attempt")
async def submit_quiz_attempt(quiz_id: str, attempt_data: dict, current_user: User = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    answers = attempt_data.get("answers", [])
    score = _grade(quiz, answers)
    first_attempt = await db.quiz_attempts.find_one({"quiz_id": quiz_id, "user_id": current_user.id}) is None

    attempt = {
        "id": str(uuid.uuid4()), "quiz_id": quiz_id, "user_id": current_user.id,
        "quiz_title": quiz["title"], "subject": quiz.get("subject", "General"),
        "answers": answers, "score": score,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quiz_attempts.insert_one(attempt)

    points_earned = score if first_attempt else 0
    await award_points(current_user.id, points_earned, "quiz")
    streak = await touch_streak(current_user.id)

    challenge_completed = None
    if current_user.role == "student" and current_user.teacher_id:
        today = date.today().isoformat()
        chs = await db.challenges.find({
            "teacher_id": current_user.teacher_id, "type": "quiz",
            "quiz_id": quiz_id, "date": today,
        }).to_list(20)
        for ch in chs:
            if await db.challenge_completions.find_one({"challenge_id": ch["id"], "student_id": current_user.id}):
                continue
            await db.challenge_completions.insert_one({
                "id": str(uuid.uuid4()), "challenge_id": ch["id"], "student_id": current_user.id,
                "score": score, "completed_at": datetime.now(timezone.utc).isoformat(),
            })
            await award_points(current_user.id, ch.get("points", 20), "challenge")
            points_earned += ch.get("points", 20)
            challenge_completed = ch["title"]

    attempt.pop("_id", None)
    new_badges = await evaluate_badges(current_user.id)
    return {**attempt, "points_earned": points_earned, "streak_days": streak,
            "first_attempt": first_attempt, "challenge_completed": challenge_completed,
            "new_badges": new_badges}


# ---------------- Activities ----------------
@api_router.get("/activities", response_model=List[Activity])
async def get_activities(subject: Optional[str] = None, difficulty: Optional[str] = None, age_group: Optional[str] = None):
    query = age_group_query(age_group)
    if subject:
        query["subject"] = subject
    if difficulty:
        query["difficulty"] = difficulty
    activities = await db.activities.find(query).to_list(200)
    return [Activity(**a) for a in activities]


@api_router.post("/activities/{activity_id}/complete")
async def complete_activity(activity_id: str, completion: ActivityCompletion, current_user: User = Depends(get_current_user)):
    activity = await db.activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    first = await db.activity_results.find_one({"activity_id": activity_id, "user_id": current_user.id}) is None
    await db.activity_results.insert_one({
        "id": str(uuid.uuid4()), "activity_id": activity_id, "user_id": current_user.id,
        "activity_title": activity["title"], "subject": activity.get("subject", "General"),
        "score": completion.score, "completed_at": datetime.now(timezone.utc).isoformat(),
    })
    points = ACTIVITY_POINTS if first else 0
    await award_points(current_user.id, points, "activity")
    streak = await touch_streak(current_user.id)
    new_badges = await evaluate_badges(current_user.id)
    return {"points_earned": points, "streak_days": streak, "first_completion": first,
            "new_badges": new_badges}


# ---------------- Content ----------------
@api_router.get("/content")
async def get_content(subject: Optional[str] = None, type: Optional[str] = None, age_group: Optional[str] = None):
    query = age_group_query(age_group)
    if subject:
        query["subject"] = subject
    if type:
        query["type"] = type
    items = await db.content.find(query, {"_id": 0}).to_list(300)
    return items


@api_router.get("/content/{content_id}")
async def get_content_item(content_id: str):
    item = await db.content.find_one({"id": content_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    return item


# ---------------- Ideas ----------------
@api_router.post("/ideas")
async def create_idea(idea_data: IdeaShareCreate, current_user: User = Depends(get_current_user)):
    idea = IdeaShare(**idea_data.dict(), author_id=current_user.id, author_name=current_user.full_name)
    await db.ideas.insert_one(idea.dict())
    new_badges = await evaluate_badges(current_user.id)
    return {**idea.dict(), "new_badges": new_badges}


@api_router.get("/ideas")
async def get_ideas(category: Optional[str] = None, sort: str = "new", current_user: User = Depends(get_current_user)):
    query = {"category": category} if category else {}
    sort_key = "likes" if sort == "popular" else "created_at"
    ideas = await db.ideas.find(query, {"_id": 0}).sort(sort_key, -1).to_list(100)
    result = []
    for idea in ideas:
        liked_by = idea.get("liked_by", [])
        comments = await db.idea_comments.count_documents({"idea_id": idea["id"]})
        result.append({**idea, "liked": current_user.id in liked_by, "comments_count": comments,
                       "liked_by": []})
    return result


@api_router.get("/ideas/spotlights")
async def get_spotlighted_ideas(current_user: User = Depends(get_current_user)):
    ideas = await db.ideas.find({"spotlight": {"$ne": None}}, {"_id": 0}).sort("spotlight.at", -1).to_list(20)
    result = []
    for idea in ideas:
        comments = await db.idea_comments.count_documents({"idea_id": idea["id"]})
        result.append({**idea, "liked": current_user.id in idea.get("liked_by", []),
                       "comments_count": comments, "liked_by": []})
    return result


@api_router.post("/ideas/{idea_id}/spotlight")
async def spotlight_idea(idea_id: str, current_user: User = Depends(require_teacher)):
    idea = await db.ideas.find_one({"id": idea_id})
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    current = idea.get("spotlight")
    if current and current.get("teacher_id") == current_user.id:
        await db.ideas.update_one({"id": idea_id}, {"$set": {"spotlight": None}})
        return {"spotlighted": False}
    await db.ideas.update_many({"spotlight.teacher_id": current_user.id}, {"$set": {"spotlight": None}})
    sp = {"teacher_id": current_user.id, "teacher_name": current_user.full_name,
          "at": datetime.now(timezone.utc).isoformat()}
    await db.ideas.update_one({"id": idea_id}, {"$set": {"spotlight": sp}})
    await evaluate_badges(idea["author_id"])
    return {"spotlighted": True, "spotlight": sp}


@api_router.get("/ideas/{idea_id}")
async def get_idea(idea_id: str, current_user: User = Depends(get_current_user)):
    idea = await db.ideas.find_one({"id": idea_id}, {"_id": 0})
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    comments = await db.idea_comments.find({"idea_id": idea_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    liked_by = idea.get("liked_by", [])
    idea["liked"] = current_user.id in liked_by
    idea["liked_by"] = []
    return {**idea, "comments": comments}


@api_router.post("/ideas/{idea_id}/like")
async def like_idea(idea_id: str, current_user: User = Depends(get_current_user)):
    idea = await db.ideas.find_one({"id": idea_id})
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    liked_by = idea.get("liked_by", [])
    if current_user.id in liked_by:
        await db.ideas.update_one({"id": idea_id}, {"$pull": {"liked_by": current_user.id}, "$inc": {"likes": -1}})
        return {"liked": False, "likes": idea.get("likes", 0) - 1}
    await db.ideas.update_one({"id": idea_id}, {"$addToSet": {"liked_by": current_user.id}, "$inc": {"likes": 1}})
    return {"liked": True, "likes": idea.get("likes", 0) + 1}


@api_router.post("/ideas/{idea_id}/comments")
async def add_comment(idea_id: str, comment: CommentCreate, current_user: User = Depends(get_current_user)):
    if not comment.text.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    idea = await db.ideas.find_one({"id": idea_id})
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    doc = {
        "id": str(uuid.uuid4()), "idea_id": idea_id, "author_id": current_user.id,
        "author_name": current_user.full_name, "author_role": current_user.role,
        "text": comment.text.strip(), "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.idea_comments.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------- Chat & Mentorship ----------------
@api_router.get("/users/search")
async def search_users(q: str, current_user: User = Depends(get_current_user)):
    if not q.strip():
        return []
    regex = {"$regex": re.escape(q.strip()[:50]), "$options": "i"}
    users = await db.users.find({
        "id": {"$ne": current_user.id},
        "$or": [{"username": regex}, {"full_name": regex}],
    }).to_list(20)
    return [safe_user(u) for u in users]


@api_router.post("/chat/send")
async def send_message(msg: MessageCreate, current_user: User = Depends(get_current_user)):
    recipient = await db.users.find_one({"id": msg.recipient_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    if not msg.text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    doc = {
        "id": str(uuid.uuid4()), "sender_id": current_user.id, "sender_name": current_user.full_name,
        "recipient_id": msg.recipient_id, "text": msg.text.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(), "read": False,
    }
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/chat/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    msgs = await db.messages.find({
        "$or": [{"sender_id": current_user.id}, {"recipient_id": current_user.id}]
    }, {"_id": 0}).sort("created_at", -1).to_list(1000)
    partners = {}
    for m in msgs:
        pid = m["recipient_id"] if m["sender_id"] == current_user.id else m["sender_id"]
        if pid not in partners:
            partners[pid] = {"last_message": m["text"], "last_at": m["created_at"], "unread": 0}
        if m["recipient_id"] == current_user.id and not m.get("read"):
            partners[pid]["unread"] += 1
    if not partners:
        return []
    users = await db.users.find({"id": {"$in": list(partners.keys())}}).to_list(100)
    user_map = {u["id"]: u for u in users}
    result = []
    for pid, info in partners.items():
        if pid in user_map:
            result.append({**safe_user(user_map[pid]), **info})
    result.sort(key=lambda x: x["last_at"], reverse=True)
    return result


@api_router.get("/chat/with/{user_id}")
async def get_messages_with(user_id: str, current_user: User = Depends(get_current_user)):
    partner = await db.users.find_one({"id": user_id})
    if not partner:
        raise HTTPException(status_code=404, detail="User not found")
    await db.messages.update_many(
        {"sender_id": user_id, "recipient_id": current_user.id, "read": False},
        {"$set": {"read": True}},
    )
    msgs = await db.messages.find({
        "$or": [
            {"sender_id": current_user.id, "recipient_id": user_id},
            {"sender_id": user_id, "recipient_id": current_user.id},
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"partner": safe_user(partner), "messages": msgs}


@api_router.post("/teacher/add-student/{student_id}")
async def add_student(student_id: str, current_user: User = Depends(require_teacher)):
    student = await db.users.find_one({"id": student_id})
    if not student or student.get("role") != "student":
        raise HTTPException(status_code=404, detail="Student not found")
    if student.get("teacher_id") == current_user.id:
        raise HTTPException(status_code=400, detail="Already your student")
    await db.users.update_one(
        {"id": student_id},
        {"$set": {"teacher_id": current_user.id, "teacher_name": current_user.full_name}},
    )
    await check_teacher_verification(current_user.id)
    student = await db.users.find_one({"id": student_id})
    return safe_user(student)


async def _student_stats(uid: str) -> dict:
    attempts = await db.quiz_attempts.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    best = {}
    for a in attempts:
        best[a["quiz_id"]] = max(best.get(a["quiz_id"], 0), a["score"])
    avg = round(sum(best.values()) / len(best)) if best else 0
    results = await db.activity_results.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    return {"quizzes_completed": len(best), "avg_score": avg,
            "activities_completed": len({r["activity_id"] for r in results}),
            "attempts": attempts, "best": best}


@api_router.get("/teacher/students")
async def get_my_students(current_user: User = Depends(require_teacher)):
    students = await db.users.find({"teacher_id": current_user.id}).to_list(200)
    result = []
    for s in students:
        stats = await _student_stats(s["id"])
        result.append({**safe_user(s), "last_active": s.get("last_active"),
                       "quizzes_completed": stats["quizzes_completed"],
                       "avg_score": stats["avg_score"],
                       "activities_completed": stats["activities_completed"]})
    return result


@api_router.get("/teacher/verification")
async def get_verification(current_user: User = Depends(require_teacher)):
    students = await db.users.count_documents({"teacher_id": current_user.id})
    challenges = await db.challenges.count_documents({"teacher_id": current_user.id})
    await check_teacher_verification(current_user.id)
    user = await db.users.find_one({"id": current_user.id})
    return {"verified": user.get("verified", False), "students_count": students,
            "challenges_count": challenges,
            "requirements": {"min_students": VERIFY_MIN_STUDENTS, "min_challenges": VERIFY_MIN_CHALLENGES}}


# ---------------- Stats ----------------
async def _full_student_stats(user: dict) -> dict:
    uid = user["id"]
    ag = user.get("age_group")
    base = await _student_stats(uid)

    quiz_query = age_group_query(ag)
    all_quizzes = await db.quizzes.find(quiz_query, {"_id": 0, "id": 1, "subject": 1}).to_list(500)
    all_activities = await db.activities.find(quiz_query, {"_id": 0, "id": 1, "subject": 1}).to_list(500)
    quiz_ids = {q["id"] for q in all_quizzes}
    act_ids = {a["id"] for a in all_activities}

    results = await db.activity_results.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    done_quizzes = set(base["best"].keys()) & quiz_ids
    done_acts = {r["activity_id"] for r in results} & act_ids
    valid_best = [s for qid, s in base["best"].items() if qid in quiz_ids]
    avg_score = round(sum(valid_best) / len(valid_best)) if valid_best else 0

    total = len(quiz_ids) + len(act_ids)
    progress = min(100, round((len(done_quizzes) + len(done_acts)) / total * 100)) if total else 0

    subject_progress = []
    for subj in SUBJECTS:
        sq = {q["id"] for q in all_quizzes if q["subject"] == subj}
        sa = {a["id"] for a in all_activities if a["subject"] == subj}
        s_total = len(sq) + len(sa)
        s_done = len(done_quizzes & sq) + len(done_acts & sa)
        subject_progress.append({"subject": subj, "completed": s_done, "total": s_total,
                                 "pct": min(100, round(s_done / s_total * 100)) if s_total else 0})

    ideas = await db.ideas.count_documents({"author_id": uid})
    certs = await db.certificates.count_documents({"student_id": uid})
    badges_earned = await db.user_badges.count_documents({"user_id": uid})
    recent = sorted(base["attempts"], key=lambda a: str(a.get("completed_at", "")), reverse=True)[:5]
    fresh = await db.users.find_one({"id": uid})

    return {
        "role": "student", "points": fresh.get("points", 0), "streak_days": fresh.get("streak_days", 0),
        "quizzes_completed": len(done_quizzes), "total_quizzes": len(quiz_ids),
        "avg_score": avg_score,
        "activities_completed": len(done_acts), "total_activities": len(act_ids),
        "ideas_shared": ideas, "certificates": certs, "progress": progress,
        "badges_earned": badges_earned, "badges_total": len(BADGE_DEFS),
        "subject_progress": subject_progress,
        "recent_attempts": [{"quiz_title": a.get("quiz_title", "Quiz"), "score": a["score"], "completed_at": str(a.get("completed_at", ""))} for a in recent],
        "teacher_name": fresh.get("teacher_name"), "age_group": ag,
    }


@api_router.get("/stats/me")
async def get_my_stats(current_user: User = Depends(get_current_user)):
    if current_user.role == "teacher":
        students = await db.users.count_documents({"teacher_id": current_user.id})
        challenges = await db.challenges.count_documents({"teacher_id": current_user.id})
        tournaments = await db.tournaments.count_documents({"teacher_id": current_user.id})
        pro = await db.tournaments.count_documents({"teacher_id": current_user.id, "is_professional": True})
        return {"role": "teacher", "verified": current_user.verified, "students_count": students,
                "challenges_count": challenges, "tournaments_count": tournaments, "pro_tournaments": pro,
                "requirements": {"min_students": VERIFY_MIN_STUDENTS, "min_challenges": VERIFY_MIN_CHALLENGES}}
    return await _full_student_stats(current_user.dict())


@api_router.get("/stats/weekly")
async def weekly_recap(current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Weekly recap is for students")
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    uid = current_user.id
    events = await db.point_events.find({"user_id": uid, "created_at": {"$gte": since}}, {"_id": 0}).to_list(2000)
    attempts = await db.quiz_attempts.find({"user_id": uid, "completed_at": {"$gte": since}}, {"_id": 0}).to_list(1000)
    acts = await db.activity_results.find({"user_id": uid, "completed_at": {"$gte": since}}, {"_id": 0}).to_list(1000)
    chall = await db.challenge_completions.find({"student_id": uid, "completed_at": {"$gte": since}}, {"_id": 0}).to_list(1000)
    certs = await db.certificates.count_documents({"student_id": uid, "awarded_at": {"$gte": since}})

    points_week = sum(e["points"] for e in events)
    by_reason = {}
    for e in events:
        r = e.get("reason", "other")
        by_reason[r] = by_reason.get(r, 0) + e["points"]

    active_days = {str(x.get("completed_at", ""))[:10] for x in attempts + acts + chall}
    active_days |= {e["created_at"][:10] for e in events}
    active_days.discard("")

    fresh = await db.users.find_one({"id": uid})
    my_points = fresh.get("points", 0)
    rank_general = await db.users.count_documents({"role": "student", "points": {"$gt": my_points}}) + 1
    rank_age = None
    if fresh.get("age_group"):
        rank_age = await db.users.count_documents(
            {"role": "student", "age_group": fresh["age_group"], "points": {"$gt": my_points}}) + 1

    best_quiz = max(attempts, key=lambda a: a["score"], default=None)
    return {
        "points_week": points_week,
        "points_by_reason": by_reason,
        "quizzes_week": len(attempts),
        "best_quiz": {"title": best_quiz.get("quiz_title", "Quiz"), "score": best_quiz["score"]} if best_quiz else None,
        "activities_week": len({a["activity_id"] for a in acts}),
        "challenges_week": len(chall),
        "certificates_week": certs,
        "active_days": len(active_days),
        "streak_days": fresh.get("streak_days", 0),
        "rank_general": rank_general,
        "rank_age_group": rank_age,
        "age_group": fresh.get("age_group"),
        "total_points": my_points,
    }


@api_router.get("/stats/student/{student_id}")
async def get_student_stats(student_id: str, current_user: User = Depends(require_teacher)):
    student = await db.users.find_one({"id": student_id})
    if not student or student.get("teacher_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not your student")
    stats = await _full_student_stats(student)
    return {**stats, "full_name": student["full_name"], "username": student["username"]}


# ---------------- Challenges ----------------
@api_router.post("/challenges")
async def create_challenge(data: ChallengeCreate, current_user: User = Depends(require_teacher)):
    if data.type not in ("quiz", "task"):
        raise HTTPException(status_code=400, detail="Type must be 'quiz' or 'task'")
    if data.type == "quiz":
        if not data.quiz_id or not await db.quizzes.find_one({"id": data.quiz_id}):
            raise HTTPException(status_code=404, detail="Linked quiz not found")
    doc = {
        "id": str(uuid.uuid4()), "teacher_id": current_user.id, "teacher_name": current_user.full_name,
        "title": data.title, "description": data.description, "type": data.type,
        "quiz_id": data.quiz_id if data.type == "quiz" else None,
        "points": data.points, "date": date.today().isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.challenges.insert_one(doc)
    await check_teacher_verification(current_user.id)
    doc.pop("_id", None)
    return doc


@api_router.get("/challenges/mine")
async def get_my_challenges(current_user: User = Depends(require_teacher)):
    challenges = await db.challenges.find({"teacher_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for ch in challenges:
        ch["completions"] = await db.challenge_completions.count_documents({"challenge_id": ch["id"]})
    return challenges


@api_router.get("/challenges/today")
async def get_todays_challenges(current_user: User = Depends(get_current_user)):
    if current_user.role != "student" or not current_user.teacher_id:
        return []
    today = date.today().isoformat()
    challenges = await db.challenges.find({"teacher_id": current_user.teacher_id, "date": today}, {"_id": 0}).to_list(50)
    for ch in challenges:
        ch["completed"] = await db.challenge_completions.find_one(
            {"challenge_id": ch["id"], "student_id": current_user.id}) is not None
        if ch.get("quiz_id"):
            quiz = await db.quizzes.find_one({"id": ch["quiz_id"]})
            ch["quiz_title"] = quiz["title"] if quiz else None
    return challenges


@api_router.post("/challenges/{challenge_id}/complete")
async def complete_challenge(challenge_id: str, current_user: User = Depends(get_current_user)):
    ch = await db.challenges.find_one({"id": challenge_id})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if current_user.teacher_id != ch["teacher_id"]:
        raise HTTPException(status_code=403, detail="This challenge is not from your teacher")
    if ch["type"] == "quiz":
        raise HTTPException(status_code=400, detail="Complete the linked quiz to finish this challenge")
    if await db.challenge_completions.find_one({"challenge_id": challenge_id, "student_id": current_user.id}):
        raise HTTPException(status_code=400, detail="Already completed")
    await db.challenge_completions.insert_one({
        "id": str(uuid.uuid4()), "challenge_id": challenge_id, "student_id": current_user.id,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    })
    await award_points(current_user.id, ch.get("points", 20), "challenge")
    streak = await touch_streak(current_user.id)
    new_badges = await evaluate_badges(current_user.id)
    return {"points_earned": ch.get("points", 20), "streak_days": streak, "new_badges": new_badges}


# ---------------- Tournaments ----------------
def _tournament_status(t: dict) -> str:
    now = datetime.now(timezone.utc).isoformat()
    if now < t["start_at"]:
        return "upcoming"
    if now <= t["end_at"]:
        return "active"
    return "ended"


async def _finalize_tournament(t: dict):
    if _tournament_status(t) != "ended" or t.get("finalized"):
        return t
    entries = await db.tournament_entries.find(
        {"tournament_id": t["id"], "score": {"$ne": None}}).sort("score", -1).to_list(500)
    update = {"finalized": True}
    if entries:
        winner = entries[0]
        update["winner_id"] = winner["student_id"]
        update["winner_name"] = winner["student_name"]
        await db.certificates.insert_one({
            "id": str(uuid.uuid4()), "student_id": winner["student_id"],
            "student_name": winner["student_name"], "tournament_id": t["id"],
            "tournament_title": t["title"], "subject": t["subject"],
            "teacher_name": t["teacher_name"], "is_professional": t.get("is_professional", False),
            "awarded_at": datetime.now(timezone.utc).isoformat(),
        })
        await award_points(winner["student_id"], TOURNAMENT_WIN_BONUS, "contest_win")
        await evaluate_badges(winner["student_id"])
    await db.tournaments.update_one({"id": t["id"]}, {"$set": update})
    return {**t, **update}


@api_router.post("/tournaments")
async def create_tournament(data: TournamentCreate, current_user: User = Depends(require_teacher)):
    if data.scope not in ("open", "class"):
        raise HTTPException(status_code=400, detail="Scope must be 'open' or 'class'")
    if data.scope == "open" and not current_user.verified:
        raise HTTPException(status_code=403, detail="Only verified teachers can host open tournaments")
    if not await db.quizzes.find_one({"id": data.quiz_id}):
        raise HTTPException(status_code=404, detail="Linked quiz not found")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()), "title": data.title, "description": data.description,
        "subject": data.subject, "age_group": data.age_group, "scope": data.scope,
        "quiz_id": data.quiz_id, "teacher_id": current_user.id, "teacher_name": current_user.full_name,
        "is_professional": current_user.verified,
        "start_at": now.isoformat(), "end_at": (now + timedelta(days=max(1, data.duration_days))).isoformat(),
        "finalized": False, "created_at": now.isoformat(),
    }
    await db.tournaments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/tournaments")
async def get_tournaments(current_user: User = Depends(get_current_user)):
    tournaments = await db.tournaments.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    result = []
    for t in tournaments:
        t = await _finalize_tournament(t)
        status = _tournament_status(t)
        visible = (
            t["scope"] == "open"
            or t["teacher_id"] == current_user.id
            or (current_user.role == "student" and current_user.teacher_id == t["teacher_id"])
        )
        if not visible:
            continue
        participants = await db.tournament_entries.count_documents({"tournament_id": t["id"]})
        my_entry = None
        if current_user.role == "student":
            entry = await db.tournament_entries.find_one(
                {"tournament_id": t["id"], "student_id": current_user.id}, {"_id": 0})
            my_entry = entry
        age_ok = t["age_group"] == "all" or t["age_group"] == current_user.age_group
        scope_ok = t["scope"] == "open" or current_user.teacher_id == t["teacher_id"]
        can_join = (current_user.role == "student" and status == "active"
                    and my_entry is None and age_ok and scope_ok)
        quiz = await db.quizzes.find_one({"id": t["quiz_id"]})
        result.append({**t, "status": status, "participants": participants,
                       "my_entry": my_entry, "can_join": can_join,
                       "quiz_title": quiz["title"] if quiz else None})
    return result


@api_router.get("/tournaments/{tournament_id}")
async def get_tournament(tournament_id: str, current_user: User = Depends(get_current_user)):
    t = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    t = await _finalize_tournament(t)
    entries = await db.tournament_entries.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(500)
    ranking = sorted([e for e in entries if e["score"] is not None], key=lambda e: e["score"], reverse=True)
    pending = [e for e in entries if e["score"] is None]
    quiz = await db.quizzes.find_one({"id": t["quiz_id"]})
    return {**t, "status": _tournament_status(t), "ranking": ranking, "pending": pending,
            "participants": len(entries), "quiz_title": quiz["title"] if quiz else None}


@api_router.post("/tournaments/{tournament_id}/join")
async def join_tournament(tournament_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can join tournaments")
    t = await db.tournaments.find_one({"id": tournament_id})
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if _tournament_status(t) != "active":
        raise HTTPException(status_code=400, detail="Tournament is not active")
    if t["age_group"] != "all" and t["age_group"] != current_user.age_group:
        raise HTTPException(status_code=403, detail=f"This tournament is for age group {t['age_group']}")
    if t["scope"] == "class" and current_user.teacher_id != t["teacher_id"]:
        raise HTTPException(status_code=403, detail="This tournament is only for the teacher's own students")
    if await db.tournament_entries.find_one({"tournament_id": tournament_id, "student_id": current_user.id}):
        raise HTTPException(status_code=400, detail="Already joined")
    await db.tournament_entries.insert_one({
        "id": str(uuid.uuid4()), "tournament_id": tournament_id,
        "student_id": current_user.id, "student_name": current_user.full_name,
        "age_group": current_user.age_group, "score": None,
        "joined_at": datetime.now(timezone.utc).isoformat(), "completed_at": None,
    })
    return {"message": "Joined tournament"}


@api_router.post("/tournaments/{tournament_id}/submit")
async def submit_tournament(tournament_id: str, attempt_data: dict, current_user: User = Depends(get_current_user)):
    t = await db.tournaments.find_one({"id": tournament_id})
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if _tournament_status(t) != "active":
        raise HTTPException(status_code=400, detail="Tournament is not active")
    entry = await db.tournament_entries.find_one({"tournament_id": tournament_id, "student_id": current_user.id})
    if not entry:
        raise HTTPException(status_code=400, detail="Join the tournament first")
    if entry["score"] is not None:
        raise HTTPException(status_code=400, detail="You already submitted your attempt")
    quiz = await db.quizzes.find_one({"id": t["quiz_id"]})
    if not quiz:
        raise HTTPException(status_code=404, detail="Tournament quiz not found")
    score = _grade(quiz, attempt_data.get("answers", []))
    await db.tournament_entries.update_one(
        {"id": entry["id"]},
        {"$set": {"score": score, "completed_at": datetime.now(timezone.utc).isoformat()}},
    )
    await award_points(current_user.id, TOURNAMENT_POINTS, "contest")
    streak = await touch_streak(current_user.id)
    better = await db.tournament_entries.count_documents(
        {"tournament_id": tournament_id, "score": {"$gt": score}})
    new_badges = await evaluate_badges(current_user.id)
    return {"score": score, "rank": better + 1, "points_earned": TOURNAMENT_POINTS,
            "streak_days": streak, "new_badges": new_badges}


@api_router.get("/certificates/me")
async def get_my_certificates(current_user: User = Depends(get_current_user)):
    return await db.certificates.find({"student_id": current_user.id}, {"_id": 0}).sort("awarded_at", -1).to_list(100)


# ---------------- Badges API ----------------
@api_router.get("/badges")
async def get_my_badges(current_user: User = Depends(get_current_user)):
    await evaluate_badges(current_user.id)
    metrics = await _badge_metrics(current_user.id)
    earned = {b["key"]: b["earned_at"]
              for b in await db.user_badges.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)}
    badges = []
    for d in BADGE_DEFS:
        value = metrics.get(d["metric"], 0)
        badges.append({
            **d,
            "earned": d["key"] in earned,
            "earned_at": earned.get(d["key"]),
            "progress": min(value, d["goal"]),
        })
    return {"badges": badges, "earned_count": len(earned), "total": len(BADGE_DEFS)}


@api_router.get("/badges/user/{user_id}")
async def get_user_badges(user_id: str, current_user: User = Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    earned = {b["key"] for b in await db.user_badges.find({"user_id": user_id}, {"_id": 0, "key": 1}).to_list(100)}
    return {"user": safe_user(target),
            "badges": [{"key": d["key"], "name": d["name"], "description": d["description"],
                        "icon": d["icon"], "color": d["color"]} for d in BADGE_DEFS if d["key"] in earned],
            "earned_count": len(earned), "total": len(BADGE_DEFS)}


# ---------------- Class Announcements ----------------
@api_router.post("/announcements")
async def create_announcement(data: AnnouncementCreate, current_user: User = Depends(require_teacher)):
    title = data.title.strip()
    body = data.body.strip()
    if not title or not body:
        raise HTTPException(status_code=400, detail="Title and message are required")
    students = await db.users.find({"teacher_id": current_user.id}, {"_id": 0, "id": 1}).to_list(500)
    if not students:
        raise HTTPException(status_code=400, detail="You have no students yet — add students via Chat first")
    doc = {
        "id": str(uuid.uuid4()), "teacher_id": current_user.id, "teacher_name": current_user.full_name,
        "title": title, "body": body,
        "recipient_ids": [s["id"] for s in students],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.announcements.insert_one(doc)
    doc.pop("_id", None)
    return {**doc, "recipients": len(students), "read_count": 0}


@api_router.get("/announcements")
async def list_announcements(current_user: User = Depends(get_current_user)):
    if current_user.role == "teacher":
        anns = await db.announcements.find({"teacher_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
        counts = {}
        if anns:
            cursor = db.announcement_reads.aggregate([
                {"$match": {"announcement_id": {"$in": [a["id"] for a in anns]}}},
                {"$group": {"_id": "$announcement_id", "count": {"$sum": 1}}},
            ])
            counts = {r["_id"]: r["count"] async for r in cursor}
        return [{**a, "recipients": len(a.get("recipient_ids", [])),
                 "read_count": counts.get(a["id"], 0)} for a in anns]
    anns = await db.announcements.find({"recipient_ids": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    read_ids = {r["announcement_id"] for r in
                await db.announcement_reads.find({"student_id": current_user.id}, {"_id": 0}).to_list(500)}
    return [{**a, "recipient_ids": [], "read": a["id"] in read_ids} for a in anns]


@api_router.get("/announcements/unread-count")
async def unread_announcements(current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        return {"unread": 0}
    read_ids = [r["announcement_id"] for r in
                await db.announcement_reads.find({"student_id": current_user.id}, {"_id": 0, "announcement_id": 1}).to_list(1000)]
    unread = await db.announcements.count_documents(
        {"recipient_ids": current_user.id, "id": {"$nin": read_ids}})
    return {"unread": unread}


@api_router.post("/announcements/{announcement_id}/read")
async def mark_announcement_read(announcement_id: str, current_user: User = Depends(get_current_user)):
    ann = await db.announcements.find_one({"id": announcement_id})
    if not ann or current_user.id not in ann.get("recipient_ids", []):
        raise HTTPException(status_code=404, detail="Announcement not found")
    if not await db.announcement_reads.find_one({"announcement_id": announcement_id, "student_id": current_user.id}):
        await db.announcement_reads.insert_one({
            "id": str(uuid.uuid4()), "announcement_id": announcement_id, "student_id": current_user.id,
            "read_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"read": True}


@api_router.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, current_user: User = Depends(require_teacher)):
    ann = await db.announcements.find_one({"id": announcement_id})
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    if ann["teacher_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own announcements")
    await db.announcements.delete_one({"id": announcement_id})
    await db.announcement_reads.delete_many({"announcement_id": announcement_id})
    return {"deleted": True}


# ---------------- Leaderboards ----------------
@api_router.get("/leaderboard/students")
async def student_leaderboard(age_group: str = "all", subject: Optional[str] = None,
                              current_user: User = Depends(get_current_user)):
    query = {"role": "student"}
    if age_group != "all":
        query["age_group"] = age_group
    students = await db.users.find(query).to_list(1000)
    if not students:
        return []
    ids = [s["id"] for s in students]
    a_query = {"user_id": {"$in": ids}}
    if subject:
        a_query["subject"] = subject
    attempts = await db.quiz_attempts.find(a_query, {"_id": 0}).to_list(10000)
    by_user = {}
    for a in attempts:
        u = by_user.setdefault(a["user_id"], {})
        u[a["quiz_id"]] = max(u.get(a["quiz_id"], 0), a["score"])
    rows = []
    for s in students:
        best = by_user.get(s["id"], {})
        avg = round(sum(best.values()) / len(best)) if best else 0
        rows.append({"user_id": s["id"], "username": s["username"], "full_name": s["full_name"],
                     "age_group": s.get("age_group"), "points": s.get("points", 0),
                     "streak_days": s.get("streak_days", 0), "avg_score": avg,
                     "quizzes_completed": len(best)})
    if subject:
        rows.sort(key=lambda r: (r["avg_score"], r["quizzes_completed"]), reverse=True)
    else:
        rows.sort(key=lambda r: r["points"], reverse=True)
    rows = rows[:20]
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows


@api_router.get("/leaderboard/teachers")
async def teacher_leaderboard(current_user: User = Depends(get_current_user)):
    teachers = await db.users.find({"role": "teacher"}).to_list(500)
    tournaments = await db.tournaments.find({}, {"_id": 0}).to_list(500)
    entries = await db.tournament_entries.find({}, {"_id": 0}).to_list(5000)
    attempts = await db.quiz_attempts.find({}, {"_id": 0, "user_id": 1, "quiz_id": 1, "score": 1}).to_list(20000)
    best_by_user = {}
    for a in attempts:
        u = best_by_user.setdefault(a["user_id"], {})
        u[a["quiz_id"]] = max(u.get(a["quiz_id"], 0), a["score"])

    all_students = await db.users.find({"role": "student"}).to_list(2000)
    students_by_teacher = {}
    for s in all_students:
        if s.get("teacher_id"):
            students_by_teacher.setdefault(s["teacher_id"], []).append(s)

    rows = []
    for t in teachers:
        my_tournaments = [x for x in tournaments if x["teacher_id"] == t["id"]]
        pro_count = sum(1 for x in my_tournaments if x.get("is_professional"))
        my_t_ids = {x["id"] for x in my_tournaments}
        tournament_students = len({e["student_id"] for e in entries if e["tournament_id"] in my_t_ids})
        my_students = students_by_teacher.get(t["id"], [])
        if my_students:
            metrics = []
            for s in my_students:
                best = best_by_user.get(s["id"], {})
                avg = sum(best.values()) / len(best) if best else 0
                metrics.append(avg + s.get("streak_days", 0) * 10)
            student_metric = sum(metrics) / len(metrics)
        else:
            student_metric = 0
        # Best-teacher score: 75% professional tournaments, 25% student streaks + quiz scores
        score = round(0.75 * (pro_count * 100) + 0.25 * student_metric, 1)
        rows.append({"user_id": t["id"], "username": t["username"], "full_name": t["full_name"],
                     "verified": t.get("verified", False), "score": score,
                     "pro_tournaments": pro_count, "students_count": len(my_students),
                     "tournament_students": tournament_students})

    best = [dict(r) for r in sorted(rows, key=lambda r: r["score"], reverse=True)[:10]]
    popular = [dict(r) for r in sorted(rows, key=lambda r: (r["tournament_students"], r["students_count"]), reverse=True)[:10]]
    for i, r in enumerate(best):
        r["rank"] = i + 1
    for i, r in enumerate(popular):
        r["rank"] = i + 1
    return {"best": best, "popular": popular}


# ---------------- Seed ----------------
@api_router.post("/seed-data")
async def seed_sample_data(current_user: User = Depends(require_teacher)):
    now = datetime.now(timezone.utc)

    # Migrate legacy users missing new fields
    await db.users.update_many(
        {"role": {"$exists": False}},
        {"$set": {"role": "student", "points": 0, "streak_days": 0, "verified": False}},
    )

    await db.quizzes.delete_many({"created_by": "system"})
    await db.activities.delete_many({})
    await db.content.delete_many({})

    quizzes = [{**q, "id": str(uuid.uuid4()), "created_by": "system", "created_at": now} for q in QUIZZES]
    activities = [{**a, "id": str(uuid.uuid4()), "created_at": now} for a in ACTIVITIES]
    content = [{**c, "id": str(uuid.uuid4()), "created_at": now.isoformat()} for c in CONTENT_ITEMS]
    await db.quizzes.insert_many(quizzes)
    await db.activities.insert_many(activities)
    await db.content.insert_many(content)

    if not SEED_DEMO_ACCOUNTS:
        return {"message": "Seed complete (demo accounts disabled)", "quizzes": len(quizzes),
                "activities": len(activities), "content_items": len(content)}

    # Demo accounts
    async def ensure_user(username, email, full_name, password, role, age=None, verified=False, teacher_id=None, teacher_name=None, points=0, streak=0):
        existing = await db.users.find_one({"username": username})
        if existing:
            updates = {"points": points, "streak_days": streak, "verified": verified}
            if age is not None:
                updates.update({"age": age, "age_group": age_to_group(age)})
            if teacher_id:
                updates.update({"teacher_id": teacher_id, "teacher_name": teacher_name})
            await db.users.update_one({"id": existing["id"]}, {"$set": updates})
            return existing["id"]
        u = User(email=email, username=username, full_name=full_name, role=role,
                 age=age, age_group=age_to_group(age) if age else None,
                 verified=verified, teacher_id=teacher_id, teacher_name=teacher_name,
                 points=points, streak_days=streak)
        d = u.dict()
        d["password"] = hash_password(password)
        await db.users.insert_one(d)
        return u.id

    teacher_id = await ensure_user("teacher_demo", "teacher@steam.edu", "Dr. Sarah Mitchell",
                                   "TeacherDemo123!", "teacher", verified=True)
    alex_id = await ensure_user("alex_chen", "alex@steam.edu", "Alex Chen", "StudentDemo123!",
                                "student", age=14, teacher_id=teacher_id, teacher_name="Dr. Sarah Mitchell",
                                points=310, streak=4)
    maya_id = await ensure_user("maya_r", "maya@steam.edu", "Maya Robinson", "StudentDemo123!",
                                "student", age=17, teacher_id=teacher_id, teacher_name="Dr. Sarah Mitchell",
                                points=485, streak=9)
    sam_id = await ensure_user("sam_patel", "sam@steam.edu", "Sam Patel", "StudentDemo123!",
                               "student", age=19, teacher_id=teacher_id, teacher_name="Dr. Sarah Mitchell",
                               points=220, streak=2)
    ts = await db.users.find_one({"username": "teststudent"})
    if ts:
        await db.users.update_one({"id": ts["id"]}, {"$set": {
            "age": 16, "age_group": "16-18", "teacher_id": teacher_id, "teacher_name": "Dr. Sarah Mitchell"}})

    # Demo quiz attempts (fresh each seed so quiz ids stay valid)
    demo_ids = [alex_id, maya_id, sam_id]
    await db.quiz_attempts.delete_many({"user_id": {"$in": demo_ids}})
    quiz_by_title = {q["title"]: q for q in quizzes}
    demo_attempts = [
        (alex_id, "Space & Our Solar System", 80), (alex_id, "Algebra Foundations", 60),
        (maya_id, "Cells & Chemistry Basics", 100), (maya_id, "Geometry & Trigonometry", 80),
        (maya_id, "Forces & Structures", 80),
        (sam_id, "Calculus & Probability", 60), (sam_id, "Physics: Motion & Energy", 80),
    ]
    for uid, title, score in demo_attempts:
        q = quiz_by_title[title]
        await db.quiz_attempts.insert_one({
            "id": str(uuid.uuid4()), "quiz_id": q["id"], "user_id": uid,
            "quiz_title": title, "subject": q["subject"], "answers": [], "score": score,
            "completed_at": now.isoformat(),
        })

    # Demo challenges (today) + tournaments from teacher_demo
    old_tournaments = await db.tournaments.find({"teacher_id": teacher_id}).to_list(100)
    old_t_ids = [t["id"] for t in old_tournaments]
    await db.tournament_entries.delete_many({"tournament_id": {"$in": old_t_ids}})
    await db.tournaments.delete_many({"teacher_id": teacher_id})
    await db.challenges.delete_many({"teacher_id": teacher_id})
    await db.challenge_completions.delete_many({})

    math_quiz = quiz_by_title["Geometry & Trigonometry"]
    science_quiz = quiz_by_title["Cells & Chemistry Basics"]
    await db.challenges.insert_many([
        {"id": str(uuid.uuid4()), "teacher_id": teacher_id, "teacher_name": "Dr. Sarah Mitchell",
         "title": "Read one Science article", "description": "Pick any article in the Science section of the Content hub and summarize it in 3 sentences in your notebook.",
         "type": "task", "quiz_id": None, "points": 20, "date": date.today().isoformat(),
         "created_at": now.isoformat()},
        {"id": str(uuid.uuid4()), "teacher_id": teacher_id, "teacher_name": "Dr. Sarah Mitchell",
         "title": "Ace the Geometry quiz", "description": "Score as high as you can on the Geometry & Trigonometry quiz.",
         "type": "quiz", "quiz_id": math_quiz["id"], "points": 30, "date": date.today().isoformat(),
         "created_at": now.isoformat()},
        {"id": str(uuid.uuid4()), "teacher_id": teacher_id, "teacher_name": "Dr. Sarah Mitchell",
         "title": "Share one project idea", "description": "Post one creative STEAM project idea in the Ideas hub.",
         "type": "task", "quiz_id": None, "points": 15, "date": date.today().isoformat(),
         "created_at": now.isoformat()},
    ])

    t1_id = str(uuid.uuid4())
    t2_id = str(uuid.uuid4())
    await db.tournaments.insert_many([
        {"id": t1_id, "title": "Autumn Math Sprint", "description": "One shot at the Geometry & Trigonometry quiz — the highest score wins a certificate.",
         "subject": "Mathematics", "age_group": "16-18", "scope": "open", "quiz_id": math_quiz["id"],
         "teacher_id": teacher_id, "teacher_name": "Dr. Sarah Mitchell", "is_professional": True,
         "start_at": (now - timedelta(hours=1)).isoformat(), "end_at": (now + timedelta(days=7)).isoformat(),
         "finalized": False, "created_at": now.isoformat()},
        {"id": t2_id, "title": "Science Explorers Cup", "description": "Open to all ages — test your cell biology and chemistry knowledge.",
         "subject": "Science", "age_group": "all", "scope": "open", "quiz_id": science_quiz["id"],
         "teacher_id": teacher_id, "teacher_name": "Dr. Sarah Mitchell", "is_professional": True,
         "start_at": (now - timedelta(hours=1)).isoformat(), "end_at": (now + timedelta(days=10)).isoformat(),
         "finalized": False, "created_at": now.isoformat()},
    ])
    await db.tournament_entries.insert_one({
        "id": str(uuid.uuid4()), "tournament_id": t1_id, "student_id": maya_id,
        "student_name": "Maya Robinson", "age_group": "16-18", "score": 80,
        "joined_at": now.isoformat(), "completed_at": now.isoformat(),
    })

    # Demo ideas
    if await db.ideas.count_documents({}) == 0:
        authors = [(alex_id, "Alex Chen"), (maya_id, "Maya Robinson"), (sam_id, "Sam Patel"), (maya_id, "Maya Robinson")]
        for (aid, aname), idea in zip(authors, DEMO_IDEAS):
            await db.ideas.insert_one({
                "id": str(uuid.uuid4()), **idea, "author_id": aid, "author_name": aname,
                "created_at": now, "likes": 0, "liked_by": [],
            })

    return {"message": "Seed complete", "quizzes": len(quizzes), "activities": len(activities),
            "content_items": len(content)}


app.include_router(api_router)

_cors_origins = [o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',')]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=_cors_origins != ["*"],
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def ensure_indexes():
    await db.announcements.create_index("recipient_ids")
    await db.announcements.create_index("teacher_id")
    await db.announcement_reads.create_index([("announcement_id", 1), ("student_id", 1)], unique=True)
    await db.user_badges.create_index([("user_id", 1), ("key", 1)], unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
