import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.api.routes import router
from app.core.config import get_settings

logging.basicConfig(level=get_settings().log_level, format="%(asctime)s %(levelname)s %(name)s %(message)s")
app = FastAPI(title="AI Memory Hub API", version="0.1.0")
app.include_router(router, prefix="/api/v1")

@app.exception_handler(Exception)
async def unhandled_error(_: Request, exc: Exception):
    logging.getLogger(__name__).exception("Unhandled API error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

@app.get('/health')
def health(): return {"status": "ok"}

