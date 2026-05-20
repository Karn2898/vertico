"""Core schemas used across the API app."""

from pydantic import BaseModel

class CoreBase(BaseModel):
    pass

__all__ = ["CoreBase"]
