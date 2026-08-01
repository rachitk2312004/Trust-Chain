from fastapi import FastAPI

from api.routers import health, internal


def create_app() -> FastAPI:
    app = FastAPI(
        title="TrustChain AI Service",
        description="Advisory-only AI/OCR — Wave 9",
        version="0.9.0",
    )
    app.include_router(health.router)
    app.include_router(internal.router)
    return app


app = create_app()
