def test_db_package_imports():
    import db  # noqa: F401
    import db.database  # noqa: F401
    import db.models  # noqa: F401
    import db.vector.pgvector  # noqa: F401
