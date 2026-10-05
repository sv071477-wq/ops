from datetime import datetime
from typing import Any, List, Type
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import get_current_user, require_admin
from app.api.deps_services import get_batch_service
from app.models.batch import Accommodation, BatchCategory, DeliveryMode, Entity, FacultyType, ProgramType, Vertical
from app.models.user import User
from app.api.v1.batches.service import BatchService

router = APIRouter()

OPTION_MODELS = {
    "categories": BatchCategory,
    "delivery-modes": DeliveryMode,
    "delivery_modes": DeliveryMode,
    "accommodations": Accommodation,
    "entities": Entity,
    "faculty-types": FacultyType,
    "verticals": Vertical,
    "program-types": ProgramType,
}


class OptionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=255)


class OptionCreate(OptionBase):
    pass


class OptionResponse(OptionBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeliveryModeResponse(OptionResponse):
    max_hours_per_day: int = 8


def get_model(option_type: str) -> Type:
    model = OPTION_MODELS.get(option_type)
    if not model:
        raise HTTPException(status_code=404, detail="Unknown batch option type")
    return model


@router.get("/{option_type}", response_model=List[OptionResponse])
def list_options(
    option_type: str,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(get_current_user),
) -> Any:
    return service.list_options(get_model(option_type))


@router.post("/{option_type}", response_model=OptionResponse, status_code=status.HTTP_201_CREATED)
def create_option(
    option_type: str,
    option_in: OptionCreate,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_admin),
) -> Any:
    return service.create_option(get_model(option_type), option_in.name, option_in.description)


@router.patch("/{option_type}/{option_id}", response_model=OptionResponse)
def update_option(
    option_type: str,
    option_id: UUID,
    option_in: OptionCreate,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_admin),
) -> Any:
    return service.update_option(get_model(option_type), option_id, option_in.name, option_in.description)


@router.delete("/{option_type}/{option_id}")
def deactivate_option(
    option_type: str,
    option_id: UUID,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_admin),
) -> Any:
    return service.deactivate_option(get_model(option_type), option_id)
