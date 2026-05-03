import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class TaskHandle:
    id: str
    task: asyncio.Task[Any]


class LocalTaskRunner:
    """Asyncio task runner used before swapping to Celery or Dramatiq."""

    def __init__(self) -> None:
        self.tasks: dict[str, asyncio.Task[Any]] = {}

    def submit(self, task_id: str, factory: Callable[[], Awaitable[Any]]) -> TaskHandle:
        task = asyncio.create_task(self._run(task_id, factory))
        self.tasks[task_id] = task
        return TaskHandle(task_id, task)

    async def _run(self, task_id: str, factory: Callable[[], Awaitable[Any]]) -> None:
        try:
            await factory()
        except Exception:
            logger.exception("Background task failed: %s", task_id)
        finally:
            self.tasks.pop(task_id, None)

