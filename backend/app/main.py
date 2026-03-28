from fastapi import FastAPI
from app.api import operations

app = FastAPI()

@app.get("/")
def home():
    return {"message": "RAGE backend is running"}

app.include_router(operations.router)
