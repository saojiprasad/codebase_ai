class AppError(Exception):
    """Base application exception with an HTTP-friendly status code."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFoundError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=404)


class UnsafeInputError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)

