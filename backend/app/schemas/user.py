from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "Coordinator"  # Admin, Manager, Coordinator, Sales, Faculty
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


class CoordinatorMappingCreate(BaseModel):
    coordinator_id: UUID
    manager_id: UUID


class CoordinatorMappingResponse(BaseModel):
    id: UUID
    coordinator_id: UUID
    manager_id: UUID
    assigned_at: datetime
    coordinator: Optional[UserResponse] = None
    manager: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)
