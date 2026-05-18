## Why

The current tasks build flattens worker and task bundles into `tasks/target`, which makes package layout harder to reason about and couples `config.json` path resolution to the flattened output. Packaging should emit all build artifacts under `tasks/dist` and preserve a dedicated tasks directory there so runtime config paths can resolve predictably from the packaged layout.

## What Changes

- Build all task-system artifacts into `tasks/dist`.
- Build task bundles into a dedicated `tasks/dist/tasks/` subdirectory instead of flattening every bundle into the package root.
- Keep worker entrypoints and supporting worker modules in the package layout without breaking the existing `yarn worker` and direct `worker.cjs` flows.
- Update packaged `config.json` and `config.example.json` paths so task commands point at the new task bundle locations.
- Update runtime path resolution so relative paths continue to resolve from the config file location and project-relative `cwd` values still resolve from the project root.
- Update tests and documentation for the non-flattened package structure.

## Capabilities

### New Capabilities
- `tasks-packaging`: Defines the packaged tasks directory layout and config path behavior for worker-managed tasks.

### Modified Capabilities

## Impact

- Affected code: `tasks/build.mjs`, `tasks/worker/src/paths.ts`, `tasks/worker/src/config.ts`, worker CLI defaults, task config files, tests under `tests/`, and `tasks/README.md`.
- Affected behavior: generated files move from `tasks/target/` to `tasks/dist/`, default packaged config path, and relative task command/argument resolution.
- No external API or dependency changes are expected.
