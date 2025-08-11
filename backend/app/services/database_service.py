import asyncio
from contextlib import asynccontextmanager
from ..database.database import database

class DatabaseService:
    def __init__(self):
        self._lock = asyncio.Lock()
    
    @asynccontextmanager
    async def transaction(self):
        async with self._lock:
            transaction = await database.transaction()
            try:
                yield database
                await transaction.commit()
            except Exception:
                await transaction.rollback()
                raise
    
    async def execute_with_retry(self, query: str, values: dict = None, max_retries: int = 3):
        for attempt in range(max_retries):
            try:
                if values:
                    return await database.execute(query, values)
                else:
                    return await database.execute(query)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e
                await asyncio.sleep(0.1 * (attempt + 1))
    
    async def fetch_with_retry(self, query: str, values: dict = None, max_retries: int = 3):
        for attempt in range(max_retries):
            try:
                if values:
                    return await database.fetch_all(query, values)
                else:
                    return await database.fetch_all(query)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e
                await asyncio.sleep(0.1 * (attempt + 1))
    
    async def fetch_one_with_retry(self, query: str, values: dict = None, max_retries: int = 3):
        for attempt in range(max_retries):
            try:
                if values:
                    return await database.fetch_one(query, values)
                else:
                    return await database.fetch_one(query)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e
                await asyncio.sleep(0.1 * (attempt + 1))

db_service = DatabaseService()