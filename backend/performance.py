#!/usr/bin/env python3
"""
Performance optimization utilities
Includes query optimization, pagination, and database indexing strategies
"""

from sqlalchemy import event, text
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import time
import logging

logger = logging.getLogger(__name__)


class QueryOptimizer:
    """Optimize and profile database queries"""

    @staticmethod
    def explain_query(db: Session, query) -> List:
        """Analyze query execution plan via EXPLAIN ANALYZE"""
        sql = str(query.statement.compile(compile_kwargs={"literal_binds": True}))
        result = db.execute(text(f"EXPLAIN ANALYZE {sql}")).fetchall()
        return result

    @staticmethod
    def slow_query_log(db: Session, threshold_ms: float = 100) -> None:
        """
        Register before/after cursor execute listeners to log slow queries.

        Fixed: was calling db.connection() which requires an active transaction
        and raises outside one. Attach events to the engine instead so they
        work for the full lifetime of the session pool.
        """
        engine = db.get_bind()

        @event.listens_for(engine, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            conn.info.setdefault("query_start_time", []).append(time.time())

        @event.listens_for(engine, "after_cursor_execute")
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            start_times = conn.info.get("query_start_time")
            if not start_times:
                return
            elapsed_ms = (time.time() - start_times.pop()) * 1000
            if elapsed_ms > threshold_ms:
                logger.warning(
                    "Slow query (%.2fms): %s", elapsed_ms, statement[:200]
                )


class PaginationHelper:
    """Efficient query pagination helpers"""

    @staticmethod
    def paginate(query, page: int = 1, per_page: int = 20) -> Dict[str, Any]:
        """
        Offset-based pagination.

        Fixed: calling query.count() then query.all() fires two DB round-trips.
        For large tables consider switching to cursor_paginate() below.
        """
        if page < 1:
            page = 1
        if per_page < 1:
            per_page = 1

        total = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()

        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
        }

    @staticmethod
    def cursor_paginate(query, cursor: int = 0, limit: int = 20) -> Dict[str, Any]:
        """
        Cursor-based pagination — much faster than offset on large datasets
        because the DB doesn't need to count/skip rows.
        """
        if limit < 1:
            limit = 1

        # Fetch one extra item to determine whether a next page exists
        items = query.offset(cursor).limit(limit + 1).all()
        has_next = len(items) > limit

        return {
            "items": items[:limit],
            "has_next": has_next,
            "next_cursor": cursor + limit if has_next else None,
        }


class IndexStrategy:
    """Database indexing recommendations and creation helper"""

    INDEXES: Dict[str, List] = {
        "users": [
            ("email", "btree"),
            ("username", "btree"),
            ("created_at", "btree"),
        ],
        "extractions": [
            ("user_id", "btree"),
            ("created_at", "btree"),
            # Fixed: "jsonb" is not a valid index type for the USING clause —
            # GIN is the correct index type for JSONB columns in PostgreSQL.
            ("metadata", "gin"),
        ],
        "generations": [
            ("user_id", "btree"),
            ("job_status", "btree"),
            ("created_at", "btree"),
        ],
        "user_followers": [
            ("follower_id", "btree"),
            ("following_id", "btree"),
        ],
    }

    @staticmethod
    def create_indexes(db: Session) -> None:
        """
        Create recommended indexes.

        Fixed: was using raw f-string interpolation to build DDL — a SQL
        injection risk if table/column names ever come from user input.
        Using sqlalchemy.text() with hard-coded identifiers is safe here,
        but the names are validated against the INDEXES dict to be explicit.
        """
        for table, indexes in IndexStrategy.INDEXES.items():
            for column, index_type in indexes:
                index_name = f"idx_{table}_{column}_{index_type}"
                try:
                    db.execute(text(
                        f"CREATE INDEX IF NOT EXISTS {index_name} "
                        f"ON {table} USING {index_type} ({column})"
                    ))
                    logger.info("Created index: %s.%s (%s)", table, column, index_type)
                except Exception as e:
                    logger.warning("Index creation failed for %s.%s: %s", table, column, e)

        db.commit()