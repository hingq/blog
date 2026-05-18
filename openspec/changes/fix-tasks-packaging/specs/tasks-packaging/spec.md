## ADDED Requirements

### Requirement: Non-flattened packaged task layout
The build system SHALL place all task-system build artifacts under `tasks/dist` and place task bundle artifacts in a dedicated `tasks/dist/tasks/` directory instead of emitting task artifacts into the dist package root.

#### Scenario: Build emits task entrypoints under the tasks directory
- **WHEN** the tasks build is run
- **THEN** task entrypoints such as `leetcode-daily.cjs` and `fetch-daily-info.cjs` exist under `tasks/dist/tasks/`
- **AND** those task entrypoints do not exist in `tasks/dist/`

#### Scenario: Worker entrypoint remains at dist package root
- **WHEN** the tasks build is run
- **THEN** the worker entrypoint exists at `tasks/dist/worker.cjs`

### Requirement: Packaged config paths target the tasks directory
The build system SHALL write packaged `config.json` and `config.example.json` files under `tasks/dist` whose relative task paths point to `tasks/dist/tasks/`.

#### Scenario: Packaged config resolves task args
- **WHEN** the packaged worker loads the generated `config.json`
- **THEN** each configured task argument that references a packaged task entrypoint resolves to an existing file under `tasks/dist/tasks/`

#### Scenario: Packaged example config matches layout
- **WHEN** the packaged worker loads the generated `config.example.json`
- **THEN** each configured task argument that references a packaged task entrypoint resolves to `tasks/dist/tasks/`

### Requirement: Config-relative runtime path resolution
The worker SHALL continue resolving relative job commands and args from the directory that contains the loaded config file.

#### Scenario: Custom config beside packaged tasks
- **WHEN** a config file located in a package directory contains a relative task argument such as `tasks/example.cjs`
- **THEN** the worker resolves that argument relative to the config file directory

### Requirement: Project-root cwd resolution
The worker SHALL continue resolving relative job working directories from the project root rather than from the packaged config directory.

#### Scenario: Packaged config keeps project cwd
- **WHEN** a packaged config contains `cwd` set to `.`
- **THEN** the worker resolves the job working directory to the project root
