from fastapi import FastAPI
from app.api import operations

app = FastAPI()

app.include_router(operations.router)

@app.get("/")
def root():
    return {"message": "RAGE backend running"}
