## 1. Build Layout

- [x] 1.1 Update `tasks/build.mjs` so all task-system build artifacts are emitted under `tasks/dist/` instead of `tasks/target/`.
- [x] 1.2 Emit task entrypoints and task support bundles under `tasks/dist/tasks/` instead of the dist package root.
- [x] 1.3 Keep worker entrypoints and worker support bundles in `tasks/dist/` so the worker bin shim and direct dist-root worker invocation still work.
- [x] 1.4 Add build-time assertions or test coverage that flattened task entrypoints no longer exist in `tasks/dist/`.

## 2. Config Paths

- [x] 2.1 Update the packaged config copy step so `config.json` and `config.example.json` reference task entrypoints with `tasks/<entry>.cjs` relative paths.
- [x] 2.2 Verify `loadConfig` resolves packaged task args from the generated config directory to files under `tasks/dist/tasks/`.
- [x] 2.3 Verify relative `cwd` values still resolve from the project root.

## 3. Tests and Documentation

- [x] 3.1 Update worker CLI and config tests for the non-flattened package layout and default config path.
- [x] 3.2 Update task runtime tests if their imports depend on flattened output filenames.
- [x] 3.3 Update `tasks/README.md` to document the new generated layout and packaged config path rules.
- [x] 3.4 Run `yarn tasks:build` and `yarn test:tasks` to verify the package layout and worker behavior.
