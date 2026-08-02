from fastapi import FastAPI

from api.routers import execution, health, internal


def create_app() -> FastAPI:
    app = FastAPI(
        title="TrustChain AI Service",
        description="Advisory-only AI/OCR — Wave 9 / Phase 2",
        version="0.9.0",
    )
    app.include_router(health.router)
    app.include_router(internal.router)
    app.include_router(execution.router)
    return app


app = create_app()
