#!/usr/bin/env python3
"""
Structured logging configuration for KalzTunz
"""

import logging
import logging.config
import logging.handlers
import os

# Create logs directory BEFORE configuring handlers
os.makedirs("logs", exist_ok=True)

# Configure logging
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s"
        },
        "standard": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "standard",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG",
            "formatter": "json",
            "filename": "logs/kalztunz.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
        },
        "error_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "ERROR",
            "formatter": "json",
            "filename": "logs/errors.log",
            "maxBytes": 10485760,
            "backupCount": 5,
        },
    },
    "loggers": {
        "": {  # Root logger
            "handlers": ["console", "file", "error_file"],
            "level": "DEBUG",
        },
        "uvicorn": {
            "handlers": ["console", "file"],
            "level": "INFO",
        },
        "sqlalchemy": {
            "handlers": ["file"],
            "level": "WARNING",
        },
    },
}

# Initialize logging
logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)

# Log startup
logger.info("KalzTunz logging initialized", extra={
    "log_timestamp": os.getenv("LOG_TIMESTAMP", "true"),
    "environment": os.getenv("ENVIRONMENT", "development"),
})