"""Schemas for service-level request/response models."""

from pydantic import BaseModel

class ServiceBase(BaseModel):
    pass

__all__ = ["ServiceBase"]
