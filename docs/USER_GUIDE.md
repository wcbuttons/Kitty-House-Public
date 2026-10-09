# Using Kitty House


- Use **House style** beneath the heading to switch between Little House, Woodland Cabin, Neko Ramen, Moonwhisker Tower, Mountain Cabin and Cat Cafe. Each keeps its own furniture, residents and personalities in this browser. Switching saves the current house and reloads the selected setting. Little House starts with 12 cats, cabin with 10 cats and 22 furnishings, and the ramen shop with 6 cats and 12 furnishings. The tower starts with 8 cats and 15 furnishings across its welcome hearth, potion workshop, spellbook library, moonlit bedchamber and star observatory.
- Mountain Cabin starts with 8 cats and 15 placements from its own 10-piece furniture catalog, across a cedar room, sleeping loft and covered veranda. Its stone fireplace burns throughout the day with a gentle flame loop; reflected firelight grows warmer as the outside light fades. Cat Cafe starts with 7 cats and 17 placements from 13 new furniture designs, across its noodle shop, upstairs home and hillside veranda. Both have independent 16:9 artwork and saves; their former V2 names have changed without changing their saved layouts, residents or internal IDs.
- **Time of day** beside the house selector follows live U.S. Central time (`America/Chicago`), including daylight saving time. Move the slider to hold a manual time in fifteen-minute steps; **Return to live time** resumes the current clock. This preference is shared across houses and saved in this browser. Dawn, day, sunset and night blend smoothly using a fixed artistic schedule, rather than geographic sunrise or weather. No location permission is needed.
- Choose **Fullscreen** beside the zoom controls for a view of just the house, cats and background. Click or tap a cat to see its introduction; close the card to return to the quiet view. The exit control fades away; move the pointer or tap to reveal it, then choose **Exit fullscreen**, or press **Esc**. Browsers without fullscreen support still get a house-only view within the browser window. Entering this view finishes editing and keeps all applied changes.
- The cabin and ramen shop fill a standard 16:9 display with extended forest or street scenery. Moonwhisker Tower fills a portrait 9:16 display, such as 1080×1920, from its 792×1408 artwork. Other display ratios fit the complete scene without stretching it. **Time of day** is also available with the fading fullscreen controls; its panel stays visible while open.
- Watch the cats or click one to see its name, activity and personality. Click empty space to close the inspector.
- Two fixed doorways and two ladders connect all five rooms in Little House and Woodland Cabin; Neko Ramen uses its staircase and terrace doorway. Four ladders and open floor hatches connect all five tower floors. Curious cats explore more often and venture farther; cats also return to their home rooms. The inspector shows a visitor's current room and saved home separately.
- Furniture can close a passage. An amber marker appears at blocked connections while editing; move the obstruction to reopen the route. Cats take turns crossing and seek a clear landing if an edit interrupts a climb.
- **Edit house → Catalog** offers illustrated previews, search, category filters, dimensions and placed counts. Little House and cabin have 28 furniture styles; ramen adds 6 shop-specific items; the tower has its own 12 wizard furniture styles. Choose **Add**, then click a room or use **Place piece** and the numeric position fields.
- **In the house** lists every placed piece and its room, with **Move** and **Remove** controls. Dragging or changing a position leaves the original piece at 23% opacity while showing the new position at full opacity. **Cancel** or Escape restores the original; an invalid preview explains why placement is rejected.
- **Edit house → Cats** offers 18 animated coat previews, including 12 new looks derived from the original sprite pack. Search or filter coats, choose the new cat’s home room, then **Add cat**.
- **Cats → At home** lists your individual cats. Change a home room, **Find cat** to see its details, or **Remove** it. Cat choices and personalities save automatically; furniture and cat edits share **Undo/Redo**. **Reset cats** restores the selected home's starting residents and can be undone. Up to 40 cats can live in the house.
- Floor furniture attaches to the room floor. Shelves and window perches attach to the back wall. The ceiling hammock hangs two cells below a flat ceiling. Floor pieces do not stack on other pieces in this prototype; wall furniture and cat trees create elevated routes.
- **Flip**, **Remove**, **Undo**, **Redo**, **Reset layout**, **Save layout**, and **Exit edit mode** are available. Valid edits save automatically. Reset is undoable.
- **Show paths** reveals geometry, support surfaces, interaction slots, routes, states and FPS. Select a cat to highlight its path. The **25 cats** button temporarily stress-tests the scene. Use its return button or enter editing to restore your chosen roster. Stress cats are not saved over it.
- Use pause, zoom buttons, wheel zoom and **Whole house**. Pause freezes the cats and lantern flutter; live time and environmental lighting continue. A manual time holds the lighting independently. On narrow screens the editor moves below the house.
- In Little House or Woodland Cabin, open **About this little house → Try the climbing demonstration**. A high shelf starts unreachable. **Move the stepping crate** creates a route. Watch Buttons use both surfaces, then **Remove the occupied shelf** to see recovery. **Restore my house** returns to the prior layout. Demonstration changes do not autosave over your house; refreshing restores the saved house.

## Project structure

| File | Responsibility |
| --- | --- |
| `src/model.ts` | Rooms, coordinates, 28 base furniture definitions, 6 ramen items and 12 dedicated tower items, masks, anchors, placement validation and furnished defaults |
| `src/cabin-v2.ts`, `src/ramen-v2.ts` | Mountain Cabin and Cat Cafe room geometry, furniture catalogs, default placements and lighting/occlusion metadata |
| `src/house-theme.ts` | Theme selection, independent world geometry, default furnishings/residents and storage-key separation |
| `src/theme-art.ts` | Blended Aseprite day/night backgrounds, fixtures, furniture lighting, catalog thumbnails and pooled editing previews |
| `src/daylight.ts` | Live Central wall clock, manual time, global time preference storage and smooth artistic lighting weights |
| `src/daylight-art.ts`, `src/lantern-light.ts` | Masked sky palettes, moving sun and moon, stars, original sky gradient and local lantern flutter |
| `src/view-frame.ts` | Separate artwork frame and camera center for the original, widescreen and portrait homes |
| `src/navigation.ts` | Support segmentation, continuous body clearance, jump/drop and passage links, Dijkstra routing and per-room rebuilds |
| `src/simulation.ts` | Seeded personalities, utility goals, reservations, motion states, controlled jump arcs, recovery and bounded activity history |
| `src/behavior.ts` | Needs and energy changes, intention weights and personality-weighted activity durations |
| `src/cat-presentation.ts` | Simulation-timed poses, washing bouts, scratch/hide interaction rendering and greeting animations |
| `src/roaming.ts` | Curiosity-weighted room choices and returning home |
| `src/passages.ts`, `src/passage-art.ts` | Fixed connections, world-space crossing clearance, doorways, ladders and blocked markers |
| `src/scene.ts` | Phaser rendering, original house drawing, cat sprites, camera, grid, debug overlay and pointer interaction |
| `src/furniture-art.ts` | Shared furniture drawing for the house, catalog thumbnails and placement preview |
| `src/cat-model.ts`, `src/cat-looks.json` | Cat appearances, saved identity/trait schema, roster validation and population limit |
| `src/cat-catalog.ts` | Animated cat catalog, coat filters and individual home-room/removal controls |
| `src/catalog.ts` | Searchable catalog, category filters, placed counts and per-piece house inventory |
| `src/main.ts` | DOM controls, editor commands, inspector, history/storage coordination and guided demonstration |
| `src/storage.ts` | Versioned layout validation, LocalStorage adapters for furniture and cats, and bounded generic undo/redo history |
| `src/layout-updates.ts` | Refreshes only untouched older defaults while preserving every customized arrangement |
| `src/fullscreen.ts` | Fullscreen and house-only views, fading exit controls, keyboard and touch support |
| `src/style.css` | Responsive application interface |
| `tests/` | Geometry/simulation/storage regressions and actual browser workflows |
| `public/assets/cats/` | LuizMelo CC0 cat sprites and original license |
| `art/house-themes/`, `tools/house-art/`, `public/assets/houses/` | Layered Aseprite masters, repeatable asset preparation and exported game artwork |

## Geometry and AI

World coordinates are independent of CSS pixels. Each room has an upward-positive logical Y axis and a 26-pixel cell size. Furniture has explicit masks and support surfaces. Floors and furniture tops are split around obstacles. Jump links use continuous body and roof clearance checks and are constrained by upward, horizontal and drop limits. Cats use graph routes, controlled walking and parabolic arcs; no general rigid-body solver drives navigation.

Furniture changes recompute local geometry only in affected rooms, then refresh passage links across the house. Unchanged rooms retain their local surfaces and links. Current supports, goals and paths are reconciled; removed supports trigger a visible descent to a legal landing. Moving paths are invalidated. A stuck-movement timeout restarts recovery. When new furniture is placed directly through a cat, a short corrective movement can pass through the newly occupied region to escape it.

Each cat has a stable identity and home room, seeded personality, energy, curiosity, laziness and sociability. Its current room changes as it wanders, while its home assignment stays saved. Transient needs for stimulation, grooming and scratching help it choose an activity first, then a suitable reachable destination. Curiosity, passage distance, time away, fatigue, comfort, recent activities and occupied spots affect the choice. Slots are reserved from goal selection through the end of an activity. Walking cats slow down and pass in the foreground beside resting cats, without interrupting their activity or repeatedly cancelling their route. Narrow passages admit one cat at a time in arrival order. A stuck timeout measures lack of movement, not the total time spent walking. A 50ms maximum simulation delta prevents large jumps after tab suspension.

Rare social encounters use separate positions and require both cats to be awake and willing. Brief greetings or quiet company end automatically, with individual and pair cooldowns. Sleeping or busy neighbors are left alone, and canceled invitations preserve safe landings. Grooming includes pauses, hideaways have floor entrances, and cats scratch beside the post. Cat motion and lantern flutter follow the simulation clock, including Pause. Live environmental lighting samples the wall clock, so it immediately reflects the current Central time after a background tab resumes.

Activity lengths are sampled once on arrival from a bounded distribution that favors a cat's usual duration while allowing occasional longer sessions. An average cat naps for about two minutes, sits for about 40 seconds, watches from a perch for about 55 seconds and grooms for about 35 seconds. Love of naps and tiredness extend rests, curiosity favors longer watching and play, and shyer cats linger in hideaways. Sessions vary even for the same cat. See the cat behavior update for details.

## Adding content

**Furniture:** add a definition to `CATALOG` in `src/model.ts`. Define category, artwork family (`art`), dimensions, anchor, optional occupied-cell mask, surfaces and actions. V2 pieces with an inset seat use `placementCells` for their full painted footprint while `cells` describes the smaller navigation obstacle, allowing a cat to sit below the chair back without allowing another furnishing to overlap it. Existing artwork families are reusable; add a drawing branch in `paintFurniture` in `src/furniture-art.ts` for bespoke visuals. Catalog thumbnails automatically use the same drawing. Behaviour and navigation require no scene-code changes. Add the piece to `defaultLayout()` if it should appear at startup, and validate placement/navigation with tests.

**Cat artwork:** the six original families and twelve source-derived coats share the same animation geometry. `src/cat-looks.json` drives both the catalog and Phaser loading; add an entry when adding a new family. The optional `tools/cat-coats/` generator reproduces the additional coat assets. See `docs/cat-assets/` for provenance, recipes, contact sheets and verification. Add appropriately licensed PNG strips under `public/assets/cats`. Current sheets use 50×50 cells, face right, and anchor at approximately (25,32). `ANIMS` in `src/scene.ts` maps logical states to sheets and frame counts; adapt loading and the variant mapping for a different pack. Sleep/sit are static sprite poses, supplemented by breathing. Jump anticipation and landing compression are procedural. Add licensing information to `THIRD_PARTY_ASSETS.md`.

**Persistence:** `HouseStorage` reads/writes version 1 under `little-house.layout.v1`. Loads validate definitions, identities, bounds, anchors and overlap. Invalid or inaccessible storage falls back to the demo with a visible explanation. Replace the storage adapter if a host website needs a server implementation. The separate `CatStorage` adapter persists the chosen roster under `little-house.cats.v1`, including stable IDs, names, coats, home rooms and personality traits. An explicitly empty roster is valid. Cat positions, energy, goals and moment-to-moment activity are not persisted.

The other homes use separate theme-specific layout and roster keys. `DaylightClock` saves its live/manual mode and manual hour under the global `little-house.daylight.v1` key, without rewriting any house or cat profiles. Corrupt time preferences fall back to live Central time; blocked storage keeps the controls usable for the current visit.

**Environment artwork:** see the native Aseprite masters and rebuild pipeline. `npm run build:art` exports the original cabin, ramen and tower plus the two V2 environments, furniture, day/night variants and sky masks from local sources. The original home remains drawn in code. The app blends lighting locally and needs no image-generation service at runtime.

**Embedding:** serve `dist/` from a static route, or embed that route in an iframe with a useful width and height (about 900×750 or larger for detailed editing). All assets are local. The Vite build uses relative URLs for compatibility with a subdirectory. Browser storage restrictions may prevent persistence in a third-party iframe; the app reports save errors while continuing to run.
