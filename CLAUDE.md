# type-bridge Monorepo

Type-safe ORM for TypeDB - available in Python and TypeScript.

## Packages

| Package | Location | Documentation |
|---------|----------|---------------|
| **Python** | [packages/python/](./packages/python) | [CLAUDE.md](./packages/python/CLAUDE.md) |
| **TypeScript** | [packages/typescript/](./packages/typescript) | [CLAUDE.md](./packages/typescript/CLAUDE.md) |

## Quick Navigation

- **Python development**: See [packages/python/CLAUDE.md](./packages/python/CLAUDE.md)
- **TypeScript development**: See [packages/typescript/CLAUDE.md](./packages/typescript/CLAUDE.md)

## Repository Structure

```
type-bridge/
├── packages/
│   ├── python/           # Python ORM (pip install type-bridge)
│   │   ├── type_bridge/  # Source code
│   │   ├── tests/        # Unit and integration tests
│   │   ├── examples/     # Usage examples
│   │   ├── docs/         # API documentation
│   │   └── CHANGELOG.md  # Python release history
│   └── typescript/       # TypeScript ORM (npm install @type-bridge/type-bridge)
│       ├── src/          # Source code
│       ├── tests/        # Jest tests
│       └── docs/         # API documentation
├── docker-compose.yml    # TypeDB for integration tests
├── README.md             # User documentation
└── CLAUDE.md             # This file
```

## Shared Development

### Running TypeDB

Both packages use TypeDB for integration tests. Start it with:

```bash
docker compose up -d
```

TypeDB will be available at `localhost:1729`.

### Package-Specific Commands

**Python:**
```bash
cd packages/python
uv sync --extra dev
uv run pytest                    # Unit tests
./test-integration.sh            # Integration tests
```

**TypeScript:**
```bash
cd packages/typescript
npm install
npm test                         # Jest tests
npm run build                    # Build
```

## Feature Comparison

| Feature | Python | TypeScript |
|---------|--------|------------|
| CRUD Operations | Yes | Yes |
| Query Builder | Yes | Yes |
| Expression System | Yes | Yes |
| Transaction Support | Yes | Yes |
| Django-style Filters | Yes | Yes |
| Schema Management | Yes | - |
| Migrations | Yes | - |
| Code Generator | Yes | - |

## Getting Help

- `/help`: Get help with using Claude Code
- Report issues at: https://github.com/ds1sqe/type-bridge/issues
