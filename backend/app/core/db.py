import os
from pymongo import MongoClient

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "rage")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
