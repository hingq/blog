## Context

`tasks/build.mjs` currently emits worker modules, task modules, task entrypoints, and copied config files directly into `tasks/target`. The worker default config path resolves to `tasks/target/config.json`, and config arguments such as `leetcode-daily.cjs` are resolved relative to that config file directory. This works only because the task entrypoints are flattened beside the config.

The requested package layout moves all build artifacts to `tasks/dist`, keeps concrete task artifacts in a dedicated directory under that output root, and avoids flattening task artifacts into the package root. The change must preserve worker invocation patterns while updating packaged config paths to point at the new task directory.

## Goals / Non-Goals

**Goals:**
- Emit all task-system build artifacts under `tasks/dist`.
- Package task entrypoints and task support bundles under a dedicated `tasks/dist/tasks/` directory.
- Keep worker CLI entrypoints and worker support bundles available from the dist package root so direct `node tasks/dist/worker.cjs` and `yarn worker` flows remain clear.
- Copy `config.json` and `config.example.json` to the packaged config location with task `args` rewritten to the non-flattened task paths.
- Preserve config-relative path resolution for job commands and arguments.
- Cover the new layout with build, CLI, and config tests.

**Non-Goals:**
- Changing scheduler behavior, cron parsing, mail behavior, or task business logic.
- Introducing a deploy archive format such as zip or tar.
- Moving source directories out of `tasks/<task-name>/src`.

## Decisions

1. Use `tasks/dist` as the generated package root.

   All generated files owned by the task system will be written below `tasks/dist`, replacing the current `tasks/target` output root. This gives the package a conventional build-output name while keeping generated files isolated from source directories.

   Alternative considered: keep `tasks/target` and only add a nested tasks directory. That preserves existing paths but does not satisfy the requested output root.

2. Use `tasks/dist/tasks/` for packaged task bundles.

   Task entrypoints such as `leetcode-daily.cjs` and `fetch-daily-info.cjs` will live under `tasks/dist/tasks/`. Task support modules can use namespaced filenames in the same directory or task-specific subdirectories, as long as task artifacts are not emitted into the dist package root. This keeps the package simple while separating task artifacts from worker artifacts.

   Alternative considered: `tasks/dist/<task-name>/`. That gives stronger namespacing but requires more config path churn and is unnecessary for the current two task entrypoints.

3. Keep worker files and config in `tasks/dist`.

   The worker remains the package entrypoint, so `tasks/dist/worker.cjs` and `tasks/dist/config.json` stay at the dist package root. This keeps the bin shim simple and gives direct worker commands a single dist-root entrypoint.

   Alternative considered: move worker files under `tasks/dist/worker/`. That would be more symmetrical but would change default config path expectations and direct execution paths.

4. Rewrite packaged config paths during build.

   Source config files can continue to describe task commands in source-friendly terms, while the build copies them into `tasks/dist` with relative `args` pointing at `tasks/<entry>.cjs`. Runtime config resolution already treats relative args as config-directory-relative, so the packaged config can remain portable.

   Alternative considered: teach runtime resolution to infer task names automatically. That hides packaging behavior in the worker and makes custom config files harder to reason about.

5. Preserve project-root `cwd` behavior.

   `cwd` values such as `.` continue to resolve from the project root, not from the config directory, so tasks that read or write blog content keep the existing behavior. Packaged task executable paths continue to resolve from the config directory.

## Risks / Trade-offs

- Config rewrite misses a task entrypoint -> Packaged worker fails at runtime. Mitigate with tests that build the dist package and assert packaged config args resolve to existing files under `tasks/dist/tasks/`.
- Existing tests import flattened output filenames -> Tests must be updated to import worker modules from their new or retained locations according to the final layout.
- Custom configs that reference flattened task entrypoints will not automatically move -> Document that packaged configs must reference `tasks/<entry>.cjs` when using the non-flattened package.
