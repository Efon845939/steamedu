from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
import jwt
from passlib.hash import bcrypt
import bcrypt as bcrypt_lib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Create the main app without a prefix
app = FastAPI(title="STEAM Education Platform API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    full_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: str

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
    questions: List[dict]
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuizCreate(BaseModel):
    title: str
    description: str
    questions: List[dict]

class QuizAttempt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quiz_id: str
    user_id: str
    answers: List[dict]
    score: int
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IdeaShare(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str  # Science, Technology, Engineering, Art, Mathematics
    author_id: str
    author_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    likes: int = 0

class IdeaShareCreate(BaseModel):
    title: str
    description: str
    category: str

class Activity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    type: str  # drag-drop, matching, etc.
    content: dict
    difficulty: str  # Easy, Medium, Hard
    subject: str  # Science, Math, etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Utility Functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def hash_password(password: str) -> str:
    # Truncate password to 72 bytes for bcrypt compatibility
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt_lib.gensalt()
    return bcrypt_lib.hashpw(password_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Truncate password to 72 bytes for bcrypt compatibility
    password_bytes = plain_password.encode('utf-8')[:72]
    return bcrypt_lib.checkpw(password_bytes, hashed_password.encode('utf-8'))

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        
        user = await db.users.find_one({"username": username})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")

# Authentication Routes
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({
        "$or": [
            {"email": user_data.email},
            {"username": user_data.username}
        ]
    })
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Email or username already registered")
    
    # Create new user
    hashed_password = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name
    )
    
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    return user

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username})
    
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user["username"]})
    return Token(access_token=access_token, token_type="bearer")

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# Quiz Routes
@api_router.post("/quizzes", response_model=Quiz)
async def create_quiz(quiz_data: QuizCreate, current_user: User = Depends(get_current_user)):
    quiz = Quiz(**quiz_data.dict(), created_by=current_user.id)
    await db.quizzes.insert_one(quiz.dict())
    return quiz

def _strip_correct_answers(quiz: dict) -> dict:
    """Remove correct_answer from questions before returning to clients."""
    q = dict(quiz)
    q["questions"] = [
        {k: v for k, v in question.items() if k != "correct_answer"}
        for question in quiz.get("questions", [])
    ]
    return q

@api_router.get("/quizzes", response_model=List[Quiz])
async def get_quizzes():
    quizzes = await db.quizzes.find().to_list(100)
    return [Quiz(**_strip_correct_answers(quiz)) for quiz in quizzes]

@api_router.get("/quizzes/{quiz_id}", response_model=Quiz)
async def get_quiz(quiz_id: str):
    quiz = await db.quizzes.find_one({"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return Quiz(**_strip_correct_answers(quiz))

@api_router.post("/quizzes/{quiz_id}/attempt", response_model=QuizAttempt)
async def submit_quiz_attempt(quiz_id: str, attempt_data: dict, current_user: User = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Calculate score (basic implementation)
    correct_answers = 0
    total_questions = len(quiz["questions"])
    
    for i, answer in enumerate(attempt_data.get("answers", [])):
        if i < len(quiz["questions"]):
            correct_answer = quiz["questions"][i].get("correct_answer")
            if answer.get("selected") == correct_answer:
                correct_answers += 1
    
    score = int((correct_answers / total_questions) * 100) if total_questions > 0 else 0
    
    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=current_user.id,
        answers=attempt_data.get("answers", []),
        score=score
    )
    
    await db.quiz_attempts.insert_one(attempt.dict())
    return attempt

# Ideas Sharing Routes
@api_router.post("/ideas", response_model=IdeaShare)
async def create_idea(idea_data: IdeaShareCreate, current_user: User = Depends(get_current_user)):
    idea = IdeaShare(
        **idea_data.dict(),
        author_id=current_user.id,
        author_name=current_user.full_name
    )
    await db.ideas.insert_one(idea.dict())
    return idea

@api_router.get("/ideas", response_model=List[IdeaShare])
async def get_ideas(category: Optional[str] = None):
    query = {"category": category} if category else {}
    ideas = await db.ideas.find(query).sort("created_at", -1).to_list(50)
    return [IdeaShare(**idea) for idea in ideas]

@api_router.post("/ideas/{idea_id}/like")
async def like_idea(idea_id: str, current_user: User = Depends(get_current_user)):
    result = await db.ideas.update_one(
        {"id": idea_id},
        {"$inc": {"likes": 1}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Idea not found")
    return {"message": "Idea liked successfully"}

# Activities Routes
@api_router.get("/activities", response_model=List[Activity])
async def get_activities(subject: Optional[str] = None, difficulty: Optional[str] = None):
    query = {}
    if subject:
        query["subject"] = subject
    if difficulty:
        query["difficulty"] = difficulty
    
    activities = await db.activities.find(query).to_list(50)
    return [Activity(**activity) for activity in activities]

# Seed some sample data (idempotent - clears and re-seeds). Auth-protected.
@api_router.post("/seed-data")
async def seed_sample_data(current_user: User = Depends(get_current_user)):
    # Clear existing seed data to keep the demo clean
    await db.quizzes.delete_many({"created_by": "system"})
    await db.activities.delete_many({})

    sample_quizzes = [
        {
            "id": str(uuid.uuid4()),
            "title": "Basic Science Quiz",
            "description": "Test your knowledge of core science concepts",
            "questions": [
                {"question": "What is the chemical symbol for water?", "options": ["H2O", "O2", "CO2", "NaCl"], "correct_answer": "H2O"},
                {"question": "Which planet is closest to the Sun?", "options": ["Venus", "Mercury", "Earth", "Mars"], "correct_answer": "Mercury"},
                {"question": "What gas do plants absorb from the atmosphere for photosynthesis?", "options": ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], "correct_answer": "Carbon Dioxide"},
                {"question": "Which part of the cell contains the DNA?", "options": ["Cytoplasm", "Nucleus", "Ribosome", "Mitochondria"], "correct_answer": "Nucleus"},
            ],
            "created_by": "system",
            "created_at": datetime.now(timezone.utc),
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Mathematics Challenge",
            "description": "Sharpen your math skills across algebra and geometry",
            "questions": [
                {"question": "What is the value of π (pi) rounded to 2 decimal places?", "options": ["3.12", "3.14", "3.16", "3.18"], "correct_answer": "3.14"},
                {"question": "Solve: 12 × 8 = ?", "options": ["86", "94", "96", "104"], "correct_answer": "96"},
                {"question": "The sum of interior angles in a triangle is:", "options": ["90°", "180°", "270°", "360°"], "correct_answer": "180°"},
                {"question": "What is the square root of 144?", "options": ["10", "11", "12", "14"], "correct_answer": "12"},
            ],
            "created_by": "system",
            "created_at": datetime.now(timezone.utc),
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Technology & Engineering",
            "description": "How well do you know computing and engineering concepts?",
            "questions": [
                {"question": "What does CPU stand for?", "options": ["Central Processing Unit", "Computer Personal Unit", "Central Program Unit", "Control Processing Utility"], "correct_answer": "Central Processing Unit"},
                {"question": "Which language is primarily used to style web pages?", "options": ["HTML", "CSS", "Python", "SQL"], "correct_answer": "CSS"},
                {"question": "A bridge that supports weight through arches is called:", "options": ["Beam bridge", "Arch bridge", "Cable-stayed bridge", "Truss bridge"], "correct_answer": "Arch bridge"},
            ],
            "created_by": "system",
            "created_at": datetime.now(timezone.utc),
        },
    ]

    sample_activities = [
        {
            "id": str(uuid.uuid4()),
            "title": "Solar System Matching",
            "description": "Match planets with their characteristics",
            "type": "matching",
            "content": {
                "items": [
                    {"id": "mercury", "text": "Mercury", "match": "closest-to-sun"},
                    {"id": "earth", "text": "Earth", "match": "has-life"},
                    {"id": "jupiter", "text": "Jupiter", "match": "largest-planet"},
                    {"id": "mars", "text": "Mars", "match": "red-planet"},
                ],
                "matches": [
                    {"id": "closest-to-sun", "text": "Closest to the Sun"},
                    {"id": "has-life", "text": "Has life"},
                    {"id": "largest-planet", "text": "Largest planet"},
                    {"id": "red-planet", "text": "The Red Planet"},
                ],
            },
            "difficulty": "Easy",
            "subject": "Science",
            "created_at": datetime.now(timezone.utc),
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Math Operations",
            "description": "Match equations with their results",
            "type": "matching",
            "content": {
                "items": [
                    {"id": "eq1", "text": "15 + 27", "match": "result1"},
                    {"id": "eq2", "text": "8 × 9", "match": "result2"},
                    {"id": "eq3", "text": "100 ÷ 4", "match": "result3"},
                    {"id": "eq4", "text": "7²", "match": "result4"},
                ],
                "matches": [
                    {"id": "result1", "text": "42"},
                    {"id": "result2", "text": "72"},
                    {"id": "result3", "text": "25"},
                    {"id": "result4", "text": "49"},
                ],
            },
            "difficulty": "Medium",
            "subject": "Mathematics",
            "created_at": datetime.now(timezone.utc),
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Engineering Materials",
            "description": "Match materials with their key properties",
            "type": "matching",
            "content": {
                "items": [
                    {"id": "steel", "text": "Steel", "match": "strong-metal"},
                    {"id": "rubber", "text": "Rubber", "match": "flexible-material"},
                    {"id": "glass", "text": "Glass", "match": "transparent-brittle"},
                    {"id": "wood", "text": "Wood", "match": "organic-renewable"},
                ],
                "matches": [
                    {"id": "strong-metal", "text": "Strong and durable metal"},
                    {"id": "flexible-material", "text": "Flexible and elastic"},
                    {"id": "transparent-brittle", "text": "Transparent but fragile"},
                    {"id": "organic-renewable", "text": "Natural and renewable"},
                ],
            },
            "difficulty": "Hard",
            "subject": "Engineering",
            "created_at": datetime.now(timezone.utc),
        },
    ]

    await db.quizzes.insert_many(sample_quizzes)
    await db.activities.insert_many(sample_activities)

    return {
        "message": "Sample data seeded successfully",
        "quizzes_added": len(sample_quizzes),
        "activities_added": len(sample_activities),
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()