# MNU-9: Show Version

**Branch:** `marcosnunesmbs/mnu-9-show-version`
**Description:** Display package.json version in CLI banner, UI footer, and dashboard card

## Goal
Add version visibility across the application by showing the package.json version in three strategic locations: below the CLI figlet banner on startup, in the UI footer, and in a dashboard card. This improves transparency for users and helps with debugging/support by making it clear which version of Morpheus is running.

## Implementation Steps

### Step 1: Add Version to CLI Banner
**Files:** 
- `src/cli/utils/render.ts`
- `src/cli/index.ts` (reference for version reading pattern)

**What:** Modify the `renderBanner()` function to accept an optional version parameter and display it below the existing figlet ASCII art and tagline. The version should be displayed in a muted gray color for visual hierarchy, formatted as "v{version}". The start command will pass the version from package.json using the same pattern already established in `src/cli/index.ts`.

**Testing:**
1. Run `npm start -- start`
2. Verify the banner shows:
   - Figlet ASCII art "Morpheus" (cyan)
   - Tagline "The Local-First AI Agent specialized in Coding" (gray)
   - Version line "v0.2.0" (gray, centered or left-aligned)
3. Version should be readable and not interfere with existing banner aesthetics

**Details:**
- Update `renderBanner()` signature: `export function renderBanner(version?: string)`
- Add version display after the tagline: `console.log(chalk.gray(\`  v\${version || 'unknown'}\n\`));`
- In `src/cli/commands/start.ts`, get version using the same helper from `cli/index.ts` and pass to `renderBanner(version)`
- Consider extracting the version reading logic to a shared utility if not already available

### Step 2: Display Version in UI Footer
**Files:**
- `src/ui/src/components/Footer.tsx`

**What:** The UI footer already displays `projectVersion` from the `/api/status` endpoint, which reads package.json version. However, currently it shows "v{version}" next to the agent name on the right side. We need to ensure this is clearly visible and styled consistently. Review the current implementation and enhance if needed to make version more prominent.

**Testing:**
1. Run `npm start -- start --ui`
2. Open browser to `http://localhost:3333`
3. Check footer (bottom of page)
4. Verify version displays as "v0.2.0" (or current version)
5. Ensure it's readable in both light and dark themes

**Details:**
- The Footer component already uses `status?.projectVersion`
- The API endpoint `/api/status` already returns `projectVersion` from package.json
- Current implementation: `<span>v{status?.projectVersion || '0.0.0'}</span>`
- This step is primarily verification; if the version is not visible enough, consider moving it or styling it differently
- Ensure the version appears on the right side of the footer along with agent name

### Step 3: Add Version Card to Dashboard
**Files:**
- `src/ui/src/pages/Dashboard.tsx`
- `src/ui/src/components/dashboard/StatCard.tsx` (reference)

**What:** Add a new StatCard to the dashboard grid displaying the Morpheus version. The card should use the same styling and structure as existing cards (Agent Status, Node Version, Uptime, LLM Provider, LLM Model). Use a suitable icon from `lucide-react` (e.g., `Package`, `Info`, `Tag`, or `Box`). The card should display "VERSION" as the title and the version number as the value.

**Testing:**
1. Run `npm start -- start --ui`
2. Navigate to Dashboard page (/)
3. Verify new "VERSION" card appears in the grid
4. Card should show version number (e.g., "0.2.0" or "v0.2.0")
5. Card should match styling of other StatCards
6. Verify responsiveness - grid should adjust properly with additional card

**Details:**
- Add a new `StatCard` in `Dashboard.tsx` after the existing cards
- Use `status?.projectVersion` for the value (already available from useStatus hook)
- Choose icon: Consider `Box` or `Package` from lucide-react to represent the application package
- Title: "VERSION" (uppercase, matching existing card pattern)
- Value: `status?.projectVersion` (can include 'v' prefix or not, for consistency check other cards)
- Consider grid layout: Currently 3 columns on md+ screens with UsageStatsWidget spanning. New card fits naturally into the grid.
- Example:
  ```tsx
  <StatCard 
    title="VERSION"
    value={status?.projectVersion || '0.0.0'}
    icon={Box}
    subValue="Current Release"
  />
  ```

## Technical Notes

### Version Reading Pattern
The project already has an established pattern for reading package.json version:
- In `src/cli/index.ts`: `getVersion()` helper function reads from `../../package.json` relative to dist/cli/index.js
- In `src/http/api.ts`: `/api/status` endpoint reads package.json using `fs.readJson(path.join(process.cwd(), 'package.json'))`
- Both patterns are valid; CLI uses relative path from dist, API uses cwd

### UI Data Flow
- Footer and Dashboard both use `useStatus()` hook from `@/lib/api`
- This hook calls `/api/status` endpoint which already returns `projectVersion`
- No backend changes needed; version is already available in the UI

### Styling Consistency
- CLI: Use `chalk.gray()` for version to match the tagline
- UI Footer: Already styled with footer text classes
- UI Dashboard: Follow StatCard pattern with theme-aware colors (azure/matrix)

### Considerations
- Version format: Decide on "v0.2.0" vs "0.2.0" for consistency across all three locations
- CLI should gracefully handle cases where version can't be read (fallback to "unknown")
- UI already has fallback handling with `|| '0.0.0'`
- The version displayed should always match package.json to avoid confusion

## Success Criteria
- [ ] CLI banner shows version below tagline on `morpheus start`
- [ ] UI footer displays version (already implemented, verify it's working)
- [ ] Dashboard has a new VERSION card showing current version
- [ ] Version is consistent across all three locations
- [ ] Version reading is robust with fallback handling
- [ ] All changes maintain existing styling and theme support
