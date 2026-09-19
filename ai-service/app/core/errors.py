"""Structured errors so the Node backend always gets a predictable JSON shape."""
from fastapi import Request
from fastapi.responses import JSONResponse


class AIServiceError(Exception):
    def __init__(self, message: str, code: str = "ai_error", status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class LLMUnavailableError(AIServiceError):
    def __init__(self, message: str = "The language model is unavailable"):
        super().__init__(message, code="llm_unavailable", status_code=503)


async def ai_service_error_handler(request: Request, exc: AIServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": exc.code, "message": exc.message}},
    )
