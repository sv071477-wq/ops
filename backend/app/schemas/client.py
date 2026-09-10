from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class ClientBase(BaseModel):
    name: str
    code: Optional[str] = None
    vertical: str  # IT/ITES, DS/ITES, BFSI, Retail
    primary_contact_email: Optional[EmailStr] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    vertical: Optional[str] = None
    primary_contact_email: Optional[EmailStr] = None


class ClientResponse(ClientBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
