# Cooking tools and appearance

The mobile tabs stay Inicio / Ideas / Recetas. Inicio and the main menu expose Lista de compra and Bibliotecas. Actions on individual recipes use a labelled ellipsis sheet. Gallery photo replacement and recovery are owner-only.

Portions are a local preview; numeric quantities scale without modifying recipe records. Qualifiers and ranges stay intact. Cooking mode offers ingredient checks, one step at a time, and a screen wake lock when supported.

Shopping is stored per account on the current device, including manual products. Re-adding a recipe updates its ingredient rows without duplicating them or mixing units. It does not synchronize between devices. The service worker caches only the same-origin app shell/assets; server data, auth and APIs are not cached. Offline mode shows the last account's local shopping list on this device.

The recover-recipe-photo Edge Function validates bearer tokens with auth.getUser before any service-role operations. Both query and update constrain owner_id. Downloads only accept HTTPS Instagram/Meta CDN hosts, validate every redirect, content type and size, and have timeouts. Compare-and-set prevents background recovery from replacing a newly selected gallery photo. Unavailable Instagram images remain unchanged; the user can pick a gallery photo. Existing Storage policies are used; no schema or permission migrations are added.

Appearance supports system/light/dark. Semantic surfaces, links and supporting text replace fixed light colors, including the original-source fallback and Instagram instructions. Minimum control targets stay 44 CSS pixels; compact mode keeps readable gaps. Automated checks cover Chromium and WebKit, dark contrast on detail/import components, stable bottom navigation, portion changes, cooking, gallery/recovery mocks and offline shopping.

Design references: Apple HIG Dark Mode, Tab Bars, Buttons and Menus; W3C WCAG 2.2 Contrast Minimum. This is a web app following those patterns, not a native UIKit implementation.

WebKit offline CI stops a dedicated preview origin and checks a service-worker response, rather than using Playwright's broken offline emulation (microsoft/playwright#42775). Chromium additionally uses setOffline. Neither test contacts real user accounts.

## Shared shopping and stores
Shared lists reuse household/library memberships, with named profiles and per-item recipe/title/portion provenance. Members may read, add, mark purchased and remove items. Outsiders have no access; column grants prevent changing destination or attribution. Five-second polling refreshes visible lists. Shared offline snapshots are read-only; personal lists remain editable offline. No existing local purchases are automatically shared: the user selects a group explicitly.

Stores are created per household or personal account. Assignment can remember the exact normalized product name for future purchases, including manual entries. Other names are left unassigned rather than guessed. The same product may be moved with or without updating the remembered preference. Users can switch grouping between recipe and store; quantities from different recipes are not incorrectly combined. Membership management reuses existing invitation links; no invitations are sent by the agent.
