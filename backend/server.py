from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
import json
import asyncio
import random
import math

load_dotenv()

app = FastAPI(title="GPS Tracking API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/gps_tracking")
client = AsyncIOMotorClient(MONGO_URL)
db = client.gps_tracking

# Security
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
SPEED_LIMIT = int(os.getenv("SPEED_LIMIT", "80"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Models
class User(BaseModel):
    username: str
    email: str
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class GPSData(BaseModel):
    device_id: str
    latitude: float
    longitude: float
    speed: float
    altitude: Optional[float] = 0
    heading: Optional[float] = 0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    address: Optional[str] = ""
    status: str = "moving"  # moving, stopped, overspeed

class GPSInput(BaseModel):
    device_id: str
    latitude: float
    longitude: float
    speed: Optional[float] = 0
    altitude: Optional[float] = 0
    heading: Optional[float] = 0

class TravelSession(BaseModel):
    device_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    total_distance: float = 0
    max_speed: float = 0
    avg_speed: float = 0
    overspeed_count: int = 0

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                self.disconnect(connection)

manager = ConnectionManager()

# Helper Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return user

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    R = 6371  # Earth radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def determine_status(speed):
    """Determine vehicle status based on speed"""
    if speed == 0:
        return "diam"
    elif speed > SPEED_LIMIT:
        return "overspeed"
    else:
        return "bergerak"

# Routes
@app.get("/")
async def root():
    return {"message": "GPS Tracking API v1.0.0", "status": "running"}

@app.post("/api/register")
async def register(user: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"$or": [{"username": user.username}, {"email": user.email}]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username atau email sudah terdaftar")
    
    # Hash password and save user
    hashed_password = get_password_hash(user.password)
    user_dict = {
        "username": user.username,
        "email": user.email,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_dict)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "message": "Pendaftaran berhasil"}

@app.post("/api/login")
async def login(user_login: UserLogin):
    user = await db.users.find_one({"username": user_login.username})
    
    if not user or not verify_password(user_login.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "message": "Login berhasil"}

@app.get("/api/user/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user["username"],
        "email": current_user["email"],
        "created_at": current_user["created_at"]
    }

@app.post("/api/gps")
async def save_gps_data(gps_input: GPSInput, current_user: dict = Depends(get_current_user)):
    """Save GPS data manually"""
    
    # Determine status based on speed
    status = determine_status(gps_input.speed)
    
    # Create GPS data object
    gps_data = {
        "device_id": gps_input.device_id,
        "latitude": gps_input.latitude,
        "longitude": gps_input.longitude,
        "speed": gps_input.speed,
        "altitude": gps_input.altitude or 0,
        "heading": gps_input.heading or 0,
        "timestamp": datetime.utcnow(),
        "address": "",  # Will be filled by reverse geocoding
        "status": status,
        "user_id": current_user["username"]
    }
    
    # Save to database
    result = await db.gps_data.insert_one(gps_data)
    
    # Broadcast to WebSocket clients
    broadcast_data = {
        "type": "gps_update",
        "data": {
            "device_id": gps_data["device_id"],
            "latitude": gps_data["latitude"],
            "longitude": gps_data["longitude"],
            "speed": gps_data["speed"],
            "status": gps_data["status"],
            "timestamp": gps_data["timestamp"].isoformat()
        }
    }
    
    await manager.broadcast(json.dumps(broadcast_data))
    
    return {"message": "Data GPS berhasil disimpan", "id": str(result.inserted_id), "status": status}

@app.get("/api/gps/latest/{device_id}")
async def get_latest_gps(device_id: str, current_user: dict = Depends(get_current_user)):
    """Get latest GPS data for a device"""
    latest_data = await db.gps_data.find_one(
        {"device_id": device_id, "user_id": current_user["username"]},
        sort=[("timestamp", -1)]
    )
    
    if not latest_data:
        raise HTTPException(status_code=404, detail="Data GPS tidak ditemukan")
    
    latest_data["_id"] = str(latest_data["_id"])
    return latest_data

@app.get("/api/gps/history/{device_id}")
async def get_gps_history(
    device_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get GPS history with optional date filtering"""
    
    query = {"device_id": device_id, "user_id": current_user["username"]}
    
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            date_filter["$lte"] = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        query["timestamp"] = date_filter
    
    cursor = db.gps_data.find(query).sort("timestamp", -1).limit(limit)
    history = []
    
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        history.append(doc)
    
    return history

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Simulate GPS data endpoint
@app.post("/api/gps/simulate")
async def simulate_gps_data(current_user: dict = Depends(get_current_user)):
    """Generate simulated GPS data for testing"""
    
    # Jakarta area coordinates
    base_lat = -6.2088
    base_lng = 106.8456
    
    # Generate random movement
    lat_offset = random.uniform(-0.05, 0.05)
    lng_offset = random.uniform(-0.05, 0.05)
    
    simulated_data = {
        "device_id": "SIM001",
        "latitude": base_lat + lat_offset,
        "longitude": base_lng + lng_offset,
        "speed": random.uniform(0, 120),
        "altitude": random.uniform(0, 100),
        "heading": random.uniform(0, 360),
        "timestamp": datetime.utcnow(),
        "address": "Jakarta, Indonesia",
        "status": "bergerak",
        "user_id": current_user["username"]
    }
    
    # Determine status
    simulated_data["status"] = determine_status(simulated_data["speed"])
    
    # Save to database
    result = await db.gps_data.insert_one(simulated_data)
    
    # Broadcast via WebSocket
    broadcast_data = {
        "type": "gps_update",
        "data": {
            "device_id": simulated_data["device_id"],
            "latitude": simulated_data["latitude"],
            "longitude": simulated_data["longitude"],
            "speed": simulated_data["speed"],
            "status": simulated_data["status"],
            "timestamp": simulated_data["timestamp"].isoformat()
        }
    }
    
    await manager.broadcast(json.dumps(broadcast_data))
    
    return {"message": "Data simulasi berhasil dibuat", "data": {
        "device_id": simulated_data["device_id"],
        "latitude": simulated_data["latitude"],
        "longitude": simulated_data["longitude"],
        "speed": simulated_data["speed"],
        "status": simulated_data["status"],
        "timestamp": simulated_data["timestamp"].isoformat()
    }}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)