from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import time
import redis.asyncio as redis

from app.core.config import settings
from app.api.v1 import api_router
from app.db.init_db import init_db
from app.core.scheduler import start_scheduler, stop_scheduler


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class RedisRateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed rate limiting for production scalability."""
    def __init__(self, app, requests_per_window: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self._redis: redis.Redis | None = None

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            if settings.REDIS_URL:
                self._redis = redis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                )
            else:
                self._redis = redis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    password=settings.REDIS_PASSWORD,
                    db=settings.REDIS_DB,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
        return self._redis

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting if disabled
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        # Only rate limit auth endpoints for now
        if not request.url.path.startswith("/api/v1/auth/"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = f"ratelimit:{client_ip}:{request.url.path}"
        
        try:
            r = await self._get_redis()
            current = await r.incr(key)
            if current == 1:
                await r.expire(key, self.window_seconds)
            
            if current > self.requests_per_window:
                ttl = await r.ttl(key)
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                    headers={"Retry-After": str(max(ttl, 1))}
                )
        except redis.ConnectionError:
            # If Redis is unavailable, fail open in development, fail closed in production
            if settings.ENVIRONMENT == "production":
                return JSONResponse(
                    status_code=503,
                    content={"detail": "Rate limiting service unavailable"}
                )
            # In development, log and continue
            print(f"[RateLimit] Redis connection failed, continuing without rate limiting: {key}")
        except Exception as e:
            if settings.ENVIRONMENT == "production":
                return JSONResponse(
                    status_code=500,
                    content={"detail": "Rate limiting error"}
                )
            print(f"[RateLimit] Unexpected error: {e}")
        
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Only run auto-migration/seeding in development
    if settings.ENVIRONMENT != "production":
        try:
            init_db()
        except Exception as e:
            print(f"Warning: Database startup auto-migration/seeding encountered: {e}")
    else:
        print("Production mode: Skipping auto-migration. Run 'alembic upgrade head' manually.")
    
    # Start scheduler
    start_scheduler()
    
    yield
    
    # Stop scheduler on shutdown
    stop_scheduler()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url=f"{settings.API_V1_STR}/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# Security Headers
app.add_middleware(SecurityHeadersMiddleware)

# Rate Limiting (applied before CORS)
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RedisRateLimitMiddleware, requests_per_window=settings.RATE_LIMIT_REQUESTS, window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS)

# CORS Configuration - Restricted methods and headers
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
        expose_headers=["X-Total-Count"],
        max_age=600,
    )


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to Enterprise 3-Workflow Operations & Faculty Governance Platform API",
        "docs_url": f"{settings.API_V1_STR}/docs" if settings.ENVIRONMENT != "production" else "disabled",
        "version": "1.0.0"
    }


app.include_router(api_router, prefix=settings.API_V1_STR)
