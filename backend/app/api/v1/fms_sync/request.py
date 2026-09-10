from pydantic import BaseModel, Field


class FmsSyncRequest(BaseModel):
    faculty_id: str = Field(min_length=1)
    event_type: str = "HOURS_UPDATE"