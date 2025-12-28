"""CLI for TypeBridge migrations.

Usage:
    type-bridge migrate                              # Apply all pending
    type-bridge migrate 0002_add_company             # Migrate to specific
    type-bridge showmigrations                       # List status
    type-bridge sqlmigrate 0002_add_company          # Preview TypeQL
    type-bridge sqlmigrate 0002_add_company -r       # Preview rollback
    type-bridge makemigrations -n add_phone          # Generate migration
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Annotated

import typer

from type_bridge.migration.executor import MigrationError, MigrationExecutor
from type_bridge.migration.generator import MigrationGenerator
from type_bridge.migration.registry import ModelRegistry
from type_bridge.session import Database

logger = logging.getLogger(__name__)

app = typer.Typer(
    name="type-bridge",
    help="TypeBridge database migration tool",
    no_args_is_help=True,
)


def _get_db_and_executor(
    database: str,
    address: str,
    migrations_dir: Path,
    dry_run: bool,
) -> tuple[Database, MigrationExecutor]:
    """Connect to database and create executor."""
    db = Database(address=address, database=database)
    db.connect()
    executor = MigrationExecutor(db=db, migrations_dir=migrations_dir, dry_run=dry_run)
    return db, executor


@app.command()
def migrate(
    target: Annotated[
        str | None,
        typer.Argument(help="Target migration name (default: apply all pending)"),
    ] = None,
    database: Annotated[
        str,
        typer.Option("--database", "-d", help="Database name"),
    ] = "typedb",
    address: Annotated[
        str,
        typer.Option("--address", "-a", help="TypeDB server address"),
    ] = "localhost:1729",
    migrations_dir: Annotated[
        Path,
        typer.Option("--migrations-dir", "-m", help="Migrations directory"),
    ] = Path("migrations"),
    dry_run: Annotated[
        bool,
        typer.Option("--dry-run", help="Show what would be done without executing"),
    ] = False,
    verbose: Annotated[
        bool,
        typer.Option("--verbose", "-v", help="Verbose output"),
    ] = False,
) -> None:
    """Apply migrations."""
    _setup_logging(verbose)

    try:
        db, executor = _get_db_and_executor(database, address, migrations_dir, dry_run)
        results = executor.migrate(target=target)
        db.close()

        if not results:
            typer.echo("No migrations to apply")
            return

        for result in results:
            status = "OK" if result.success else "FAILED"
            action = "Applied" if result.action == "applied" else "Rolled back"
            typer.echo(f"  {action}: {result.name} ... {status}")
            if result.error:
                typer.echo(f"    Error: {result.error}")

        success_count = sum(1 for r in results if r.success)
        typer.echo(f"\n{success_count}/{len(results)} migration(s) completed")

        if not all(r.success for r in results):
            raise typer.Exit(1)

    except MigrationError as e:
        typer.echo(f"Migration error: {e}", err=True)
        raise typer.Exit(1)
    except ConnectionError as e:
        typer.echo(f"Connection error: {e}", err=True)
        typer.echo("Make sure TypeDB server is running and accessible.", err=True)
        raise typer.Exit(1)
    except Exception as e:
        logger.exception("Unexpected error")
        typer.echo(f"Error: {e}", err=True)
        raise typer.Exit(1)


@app.command()
def showmigrations(
    database: Annotated[
        str,
        typer.Option("--database", "-d", help="Database name"),
    ] = "typedb",
    address: Annotated[
        str,
        typer.Option("--address", "-a", help="TypeDB server address"),
    ] = "localhost:1729",
    migrations_dir: Annotated[
        Path,
        typer.Option("--migrations-dir", "-m", help="Migrations directory"),
    ] = Path("migrations"),
    verbose: Annotated[
        bool,
        typer.Option("--verbose", "-v", help="Verbose output"),
    ] = False,
) -> None:
    """List all migrations and their status."""
    _setup_logging(verbose)

    try:
        db, executor = _get_db_and_executor(database, address, migrations_dir, dry_run=False)
        migrations = executor.showmigrations()
        db.close()

        if not migrations:
            typer.echo("No migrations found")
            return

        app_label = migrations_dir.name
        typer.echo(app_label)

        for name, is_applied in migrations:
            status = "[X]" if is_applied else "[ ]"
            typer.echo(f" {status} {name}")

    except MigrationError as e:
        typer.echo(f"Migration error: {e}", err=True)
        raise typer.Exit(1)
    except ConnectionError as e:
        typer.echo(f"Connection error: {e}", err=True)
        typer.echo("Make sure TypeDB server is running and accessible.", err=True)
        raise typer.Exit(1)
    except Exception as e:
        logger.exception("Unexpected error")
        typer.echo(f"Error: {e}", err=True)
        raise typer.Exit(1)


@app.command()
def sqlmigrate(
    migration_name: Annotated[
        str,
        typer.Argument(help="Migration name to show"),
    ],
    reverse: Annotated[
        bool,
        typer.Option("--reverse", "-r", help="Show rollback TypeQL"),
    ] = False,
    database: Annotated[
        str,
        typer.Option("--database", "-d", help="Database name"),
    ] = "typedb",
    address: Annotated[
        str,
        typer.Option("--address", "-a", help="TypeDB server address"),
    ] = "localhost:1729",
    migrations_dir: Annotated[
        Path,
        typer.Option("--migrations-dir", "-m", help="Migrations directory"),
    ] = Path("migrations"),
    verbose: Annotated[
        bool,
        typer.Option("--verbose", "-v", help="Verbose output"),
    ] = False,
) -> None:
    """Show TypeQL for a migration."""
    _setup_logging(verbose)

    try:
        db, executor = _get_db_and_executor(database, address, migrations_dir, dry_run=False)
        typeql = executor.sqlmigrate(migration_name, reverse=reverse)
        db.close()
        typer.echo(typeql)

    except MigrationError as e:
        typer.echo(f"Migration error: {e}", err=True)
        raise typer.Exit(1)
    except ConnectionError as e:
        typer.echo(f"Connection error: {e}", err=True)
        typer.echo("Make sure TypeDB server is running and accessible.", err=True)
        raise typer.Exit(1)
    except Exception as e:
        logger.exception("Unexpected error")
        typer.echo(f"Error: {e}", err=True)
        raise typer.Exit(1)


@app.command()
def makemigrations(
    name: Annotated[
        str,
        typer.Option("--name", "-n", help="Migration name suffix"),
    ] = "auto",
    empty: Annotated[
        bool,
        typer.Option("--empty", help="Create empty migration for manual editing"),
    ] = False,
    models: Annotated[
        str | None,
        typer.Option("--models", "-M", help="Python path to models module (e.g., myapp.models)"),
    ] = None,
    database: Annotated[
        str,
        typer.Option("--database", "-d", help="Database name"),
    ] = "typedb",
    address: Annotated[
        str,
        typer.Option("--address", "-a", help="TypeDB server address"),
    ] = "localhost:1729",
    migrations_dir: Annotated[
        Path,
        typer.Option("--migrations-dir", "-m", help="Migrations directory"),
    ] = Path("migrations"),
    verbose: Annotated[
        bool,
        typer.Option("--verbose", "-v", help="Verbose output"),
    ] = False,
) -> None:
    """Auto-generate migration from model changes."""
    _setup_logging(verbose)

    try:
        db = Database(address=address, database=database)
        db.connect()
        generator = MigrationGenerator(db, migrations_dir)

        model_list: list = []

        if models:
            try:
                model_list = ModelRegistry.discover(models, register=False)
                typer.echo(f"Discovered {len(model_list)} model(s) from {models}")
            except ImportError as e:
                typer.echo(f"Error importing models module: {e}", err=True)
                raise typer.Exit(1)
        else:
            model_list = ModelRegistry.get_all()
            if model_list:
                typer.echo(f"Using {len(model_list)} registered model(s)")

        if not model_list and not empty:
            typer.echo(
                "No models found. Either:\n"
                "  1. Use --models to specify a module: makemigrations --models myapp.models\n"
                "  2. Register models with ModelRegistry.register() before running\n"
                "  3. Use --empty to create an empty migration for manual editing",
                err=True,
            )
            raise typer.Exit(1)

        path = generator.generate(models=model_list, name=name, empty=empty)
        db.close()

        if path:
            typer.echo(f"Created: {path}")
        else:
            typer.echo("No changes detected")

    except MigrationError as e:
        typer.echo(f"Migration error: {e}", err=True)
        raise typer.Exit(1)
    except ConnectionError as e:
        typer.echo(f"Connection error: {e}", err=True)
        typer.echo("Make sure TypeDB server is running and accessible.", err=True)
        raise typer.Exit(1)
    except Exception as e:
        logger.exception("Unexpected error")
        typer.echo(f"Error: {e}", err=True)
        raise typer.Exit(1)


@app.command()
def plan(
    target: Annotated[
        str | None,
        typer.Argument(help="Target migration name"),
    ] = None,
    database: Annotated[
        str,
        typer.Option("--database", "-d", help="Database name"),
    ] = "typedb",
    address: Annotated[
        str,
        typer.Option("--address", "-a", help="TypeDB server address"),
    ] = "localhost:1729",
    migrations_dir: Annotated[
        Path,
        typer.Option("--migrations-dir", "-m", help="Migrations directory"),
    ] = Path("migrations"),
    verbose: Annotated[
        bool,
        typer.Option("--verbose", "-v", help="Verbose output"),
    ] = False,
) -> None:
    """Show migration plan without executing."""
    _setup_logging(verbose)

    try:
        db, executor = _get_db_and_executor(database, address, migrations_dir, dry_run=False)
        migration_plan = executor.plan(target=target)
        db.close()

        if migration_plan.is_empty():
            typer.echo("No migrations pending")
            return

        if migration_plan.to_rollback:
            typer.echo("Rollback:")
            for loaded in migration_plan.to_rollback:
                typer.echo(f"  - {loaded.migration.name}")

        if migration_plan.to_apply:
            typer.echo("Apply:")
            for loaded in migration_plan.to_apply:
                typer.echo(f"  + {loaded.migration.name}")

    except MigrationError as e:
        typer.echo(f"Migration error: {e}", err=True)
        raise typer.Exit(1)
    except ConnectionError as e:
        typer.echo(f"Connection error: {e}", err=True)
        typer.echo("Make sure TypeDB server is running and accessible.", err=True)
        raise typer.Exit(1)
    except Exception as e:
        logger.exception("Unexpected error")
        typer.echo(f"Error: {e}", err=True)
        raise typer.Exit(1)


def _setup_logging(verbose: bool) -> None:
    """Configure logging based on verbosity."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format="%(levelname)s: %(message)s")


def main() -> None:
    """Entry point for the CLI."""
    app()


if __name__ == "__main__":
    main()
