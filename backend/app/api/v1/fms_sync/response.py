from pydantic import BaseModel


class FmsSyncResponse(BaseModel):
    status: str
    message: str
    timestamp: str