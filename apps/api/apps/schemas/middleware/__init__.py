"""Middleware-related schemas and utilities."""

from pydantic import BaseModel

class MiddlewareBase(BaseModel):
    pass

__all__ = ["MiddlewareBase"]
