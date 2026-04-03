# Twikoo Hidden Admin Entry Design

## Goal

Keep the Twikoo comment area visible to all visitors while hiding the admin entry by default, and reveal that entry only after entering a special passphrase. This passphrase is an extra UX gate only; Twikoo's own admin authentication remains the real permission boundary.

## Current Context

- The site uses Twikoo as the active comment provider in `data/siteMetadata.js`.
- `components/Comments.tsx` renders the standard comment section shell and lazy-loads the provider after the user clicks `加载评论`.
- `components/TwikooComments.tsx` dynamically imports `twikoo` and calls `twikoo.init(...)`.
- Existing comment coverage is source-level regression tests in `tests/comments-regression.test.cjs`.

## Requirements

- Normal visitors must still be able to read and post comments.
- The Twikoo admin entry must not be directly visible by default.
- A special passphrase should reveal the admin entry through Twikoo's native interaction model.
- The site must not replace or weaken Twikoo's own admin login flow.
- The change should minimize divergence from upstream Twikoo behavior.

## Approaches Considered

### 1. Reuse Twikoo's built-in hidden admin entry

Pass the relevant hidden-admin configuration through the site's existing Twikoo wrapper and let Twikoo handle the passphrase flow internally.

Pros:
- Smallest code change.
- Best compatibility with Twikoo upgrades.
- Keeps admin UX aligned with the provider's own behavior.

Cons:
- Limited control over the exact reveal interaction.
- Depends on Twikoo recognizing the forwarded options.

### 2. Add a site-level admin reveal layer

Build a custom front-end passphrase gate that toggles a separate admin hint or entry before the user reaches Twikoo's own login panel.

Pros:
- Full control over UI copy and interaction.
- Easy to style in the site's own visual language.

Cons:
- Adds duplicate state on top of Twikoo.
- Increases maintenance and upgrade risk.
- Still cannot replace Twikoo's real admin authentication.

### 3. Use a non-visual trigger such as URL params or key sequence

Hide the entry until a secret query string or keyboard sequence is used.

Pros:
- Cleanest visible UI.

Cons:
- Poor discoverability for the site owner.
- Harder to maintain and document.
- Less intuitive than Twikoo's native passphrase flow.

## Decision

Choose approach 1. The implementation will be a thin configuration pass-through that reuses Twikoo's native hidden-admin capability instead of reimplementing admin reveal logic in the site.

## Design

### Configuration

- Extend `TwikooConfig` in `types/comments.ts` to include the hidden-admin settings needed by Twikoo.
- Add the passphrase-related settings in `data/siteMetadata.js` under `comments.twikooConfig`.
- Keep the new fields optional so the site can safely fall back to current behavior if the settings are absent.

### Rendering Flow

- Keep `components/Comments.tsx` unchanged in behavior: comment shell renders as it does today, and Twikoo still loads only after `加载评论`.
- Update `components/TwikooComments.tsx` so the Twikoo init call forwards the new hidden-admin configuration alongside `envId` and `lang`.
- Do not add a separate site-managed admin mode, local passphrase store, or custom admin button.

### Error Handling

- If the hidden-admin config is missing, the comment system should continue to initialize normally.
- If Twikoo ignores the forwarded options, the failure mode should be limited to the admin entry visibility behavior; normal comment rendering must keep working.
- Keep the existing dynamic import and init resolution safeguards in `components/TwikooComments.tsx`.

### Testing

- Extend `tests/comments-regression.test.cjs` with assertions that:
  - `types/comments.ts` allows the hidden-admin config fields.
  - `components/TwikooComments.tsx` forwards the extra Twikoo config into `twikoo.init(...)`.
  - `data/siteMetadata.js` contains the configured hidden-admin values.
- Stay with source-level regression coverage instead of browser E2E because the repository already validates comments at the source layer and this feature is primarily an integration/configuration change.

## Out of Scope

- Replacing Twikoo's admin login or session model.
- Encrypting or masking the passphrase in the client bundle.
- Building a custom admin dashboard outside Twikoo.
- Adding browser automation coverage unless later regression evidence justifies it.

## Implementation Constraints

- Favor a minimal patch set and keep Twikoo integration as a thin wrapper.
- Preserve the existing lazy-load behavior for comments.
- Avoid changes that would interfere with current comment styling or post layouts.
