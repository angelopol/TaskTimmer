"""Convert this project's phpMyAdmin data dump into PostgreSQL INSERT statements.

Usage: python scripts/mysql_dump_to_postgres.py SOURCE.sql OUTPUT.sql
Create the PostgreSQL tables with `prisma migrate deploy` before loading OUTPUT.sql.
"""

import argparse
import re
from pathlib import Path


TABLES = {
    "User": ("name", "email", "passwordHash", "createdAt", "updatedAt"),
    "Activity": ("userId", "name", "color", "weeklyTargetMinutes", "active", "createdAt", "updatedAt"),
    "ScheduleSegment": ("userId", "activityId", "weekday", "startMinute", "endMinute", "notes", "createdAt", "updatedAt", "effectiveFrom", "effectiveTo"),
    "TimeLog": ("userId", "activityId", "segmentId", "date", "startedAt", "endedAt", "minutes", "partial", "source", "comment", "createdAt", "updatedAt"),
}
BOOLEAN_COLUMNS = {("Activity", "active"), ("TimeLog", "partial")}
INSERT = re.compile(r"INSERT INTO `(?P<table>\w+)`\s*\((?P<columns>[^)]+)\)\s*VALUES\s*", re.I)
ESCAPES = {"0": "\0", "b": "\b", "n": "\n", "r": "\r", "t": "\t", "Z": "\x1a"}


def read_string(source: str, pos: int) -> tuple[str, int]:
    assert source[pos] == "'"
    pos += 1
    result = []
    while pos < len(source):
        char = source[pos]
        if char == "'":
            if pos + 1 < len(source) and source[pos + 1] == "'":
                result.append("'")
                pos += 2
                continue
            return "".join(result), pos + 1
        if char == "\\":
            pos += 1
            if pos >= len(source):
                raise ValueError("Unterminated MySQL escape")
            result.append(ESCAPES.get(source[pos], source[pos]))
        else:
            result.append(char)
        pos += 1
    raise ValueError("Unterminated MySQL string")


def parse_rows(source: str, pos: int):
    while True:
        while source[pos].isspace():
            pos += 1
        if source[pos] != "(":
            raise ValueError(f"Expected row at offset {pos}")
        pos += 1
        row = []
        while True:
            while source[pos].isspace():
                pos += 1
            if source[pos] == "'":
                value, pos = read_string(source, pos)
            else:
                end = pos
                while source[end] not in ",)":
                    end += 1
                value = source[pos:end].strip()
                if not re.fullmatch(r"NULL|-?\d+(?:\.\d+)?", value, re.I):
                    raise ValueError(f"Unexpected SQL value at offset {pos}")
                if value.upper() == "NULL":
                    value = None
                pos = end
            row.append(value)
            while source[pos].isspace():
                pos += 1
            delimiter = source[pos]
            pos += 1
            if delimiter == ")":
                break
            if delimiter != ",":
                raise ValueError(f"Expected field delimiter at offset {pos}")
        yield row
        while source[pos].isspace():
            pos += 1
        delimiter = source[pos]
        pos += 1
        if delimiter == ";":
            return
        if delimiter != ",":
            raise ValueError(f"Expected row delimiter at offset {pos}")


def pg_value(value: str | None, table: str, column: str) -> str:
    if value is None:
        return "NULL"
    if (table, column) in BOOLEAN_COLUMNS:
        if value not in {"0", "1"}:
            raise ValueError(f"Invalid boolean in {table}.{column}")
        return "TRUE" if value == "1" else "FALSE"
    if column in {"weeklyTargetMinutes", "weekday", "startMinute", "endMinute", "minutes"}:
        if not re.fullmatch(r"-?\d+", value):
            raise ValueError(f"Invalid integer in {table}.{column}")
        return value
    if "\0" in value:
        raise ValueError("PostgreSQL text cannot contain NUL")
    return "'" + value.replace("'", "''") + "'"


def convert(source: str) -> tuple[str, dict[str, int]]:
    rows = {table: [] for table in TABLES}
    for match in INSERT.finditer(source):
        table = match.group("table")
        if table not in TABLES:
            raise ValueError(f"Unexpected table: {table}")
        columns = [column.strip().strip("`") for column in match.group("columns").split(",")]
        if set(columns) != {"id", *TABLES[table]} or len(columns) != len(TABLES[table]) + 1:
            raise ValueError(f"Unexpected columns in {table}: {columns}")
        for row in parse_rows(source, match.end()):
            if len(row) != len(columns):
                raise ValueError(f"Wrong field count in {table}")
            rows[table].append((columns, row))
    if any(not data for data in rows.values()):
        raise ValueError("Dump has a missing or empty expected table")
    ids = {}
    for table, data in rows.items():
        ids[table] = {row[columns.index("id")] for columns, row in data}
        if len(ids[table]) != len(data):
            raise ValueError(f"Duplicate IDs in {table}")
    for table, data in rows.items():
        for columns, row in data:
            values = dict(zip(columns, row))
            for column, target in (("userId", "User"), ("activityId", "Activity"), ("segmentId", "ScheduleSegment")):
                if column in values and values[column] is not None and values[column] not in ids[target]:
                    raise ValueError(f"Missing {target} reference in {table}.{column}")
    output = ["-- Data only. Apply the Prisma PostgreSQL migration first.", "BEGIN;"]
    for table in ("User", "Activity", "ScheduleSegment", "TimeLog"):
        for columns, row in rows[table]:
            names = ", ".join(f'"{column}"' for column in columns)
            values = ", ".join(pg_value(value, table, column) for column, value in zip(columns, row))
            output.append(f'INSERT INTO "{table}" ({names}) VALUES ({values});')
    output.append("COMMIT;")
    return "\n".join(output) + "\n", {table: len(data) for table, data in rows.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error("Source and output must differ")
    sql, counts = convert(args.source.read_text(encoding="utf-8-sig"))
    args.output.write_text(sql, encoding="utf-8")
    print("Converted rows: " + ", ".join(f"{table}={count}" for table, count in counts.items()))


if __name__ == "__main__":
    main()
