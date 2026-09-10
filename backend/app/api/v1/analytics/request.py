from pydantic import BaseModel


class MbrExportRequest(BaseModel):
    """Reserved for future export filters."""

    status: str | None = None