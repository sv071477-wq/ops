from datetime import datetime, timezone
from typing import Any, List, Type
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.batch import Accommodation, BatchCategory, DeliveryMode, Entity
from app.models.user import User

router = APIRouter()

OPTION_MODELS = {
    "categories": BatchCategory,
    "delivery-modes": DeliveryMode,
    "delivery_modes": DeliveryMode,
    "accommodations": Accommodation,
    "entities": Entity,
}


class OptionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=255)


class OptionResponse(OptionCreate):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


def get_model(option_type: str) -> Type:
    model = OPTION_MODELS.get(option_type)
    if not model:
        raise HTTPException(status_code=404, detail="Unknown batch option type")
    return model


@router.get("/{option_type}", response_model=List[OptionResponse])
def list_options(
    option_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    model = get_model(option_type)
    return db.query(model).filter(model.is_active.is_(True)).order_by(model.name).all()


@router.post("/{option_type}", response_model=OptionResponse, status_code=status.HTTP_201_CREATED)
def create_option(
    option_type: str,
    option_in: OptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Any:
    model = get_model(option_type)
    if db.query(model).filter(model.name == option_in.name.strip()).first():
        raise HTTPException(status_code=409, detail="An option with this name already exists")
    option = model(name=option_in.name.strip(), description=option_in.description)
    db.add(option)
    db.commit()
    db.refresh(option)
    return option


@router.patch("/{option_type}/{option_id}", response_model=OptionResponse)
def update_option(
    option_type: str,
    option_id: UUID,
    option_in: OptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Any:
    model = get_model(option_type)
    option = db.query(model).filter(model.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")
    option.name = option_in.name.strip()
    option.description = option_in.description
    option.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(option)
    return option


@router.delete("/{option_type}/{option_id}")
def deactivate_option(
    option_type: str,
    option_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Any:
    model = get_model(option_type)
    option = db.query(model).filter(model.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")
    option.is_active = False
    option.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"detail": "Option deactivated"}
