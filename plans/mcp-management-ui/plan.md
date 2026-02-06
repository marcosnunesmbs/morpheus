# MCP Management UI

**Branch:** `feature/mcp-management-ui`
**Description:** Create a web UI to manage MCP server configurations with CRUD operations and enable/disable toggle

## Goal
Enable users to visually manage MCP servers through the Web UI instead of manually editing `mcps.json`. Users can add, edit, delete, and enable/disable MCP servers with validation and connection testing.

## Implementation Steps

### Step 1: Backend API - MCP CRUD Endpoints
**Files:**
- `src/http/api.ts` (add routes)
- `src/config/mcp-manager.ts` (new service file)
- `src/types/mcp.ts` (add response types)

**What:**
Create protected API endpoints for MCP server management:
- `GET /api/mcp/servers` - List all MCP servers with enabled status
- `POST /api/mcp/servers` - Add new server with validation
- `PUT /api/mcp/servers/:name` - Update server configuration
- `DELETE /api/mcp/servers/:name` - Remove server
- `PATCH /api/mcp/servers/:name/toggle` - Enable/disable server (add/remove "$" prefix)

Create a service layer `MCPManager` class that:
- Reads/writes `mcps.json` safely
- Validates configs using existing Zod schemas
- Handles "$" prefix logic for enable/disable
- Filters metadata keys (`_comment`, `_docs`, `$schema`)

**Testing:**
- Use Postman/curl to test each endpoint with `x-architect-pass` header
- Verify `mcps.json` updates correctly
- Test validation errors (invalid transport, missing fields)
- Verify enabling server removes "$", disabling adds "$"

---

### Step 2: Frontend Service Layer
**Files:**
- `src/ui/src/services/mcp.ts` (new file)
- `src/ui/src/types/mcp.ts` (new file - shared types)

**What:**
Create frontend service layer for API communication:
```typescript
export const mcpService = {
  fetchServers: () => Promise<MCPServerWithStatus[]>,
  addServer: (name, config) => Promise<void>,
  updateServer: (name, config) => Promise<void>,
  deleteServer: (name) => Promise<void>,
  toggleServer: (name, enabled) => Promise<void>,
}
```

Create types for UI state:
```typescript
type MCPServerWithStatus = {
  name: string;
  enabled: boolean;
  config: MCPServerConfig;
}
```

**Testing:**
- Mock API responses and verify service methods work
- Test with existing `httpClient` authentication

---

### Step 3: Frontend Components - Form & Cards
**Files:**
- `src/ui/src/components/mcp/MCPServerForm.tsx` (new)
- `src/ui/src/components/mcp/MCPServerCard.tsx` (new)
- `src/ui/src/components/mcp/TransportFields.tsx` (new)
- `src/ui/src/components/mcp/DynamicList.tsx` (new - for args/env)

**What:**
Create reusable components:
1. **MCPServerForm** - Modal form with:
   - Name input (disabled in edit mode)
   - Transport select (stdio/http)
   - Conditional fields based on transport
   - Dynamic lists for `args[]` and `env{}`
   - Validation with Zod
   
2. **MCPServerCard** - Grid card displaying:
   - Server name
   - Transport type badge
   - Enabled/disabled toggle switch
   - Edit/Delete buttons
   - Connection status indicator [NEEDS CLARIFICATION: Should we test connection on page load?]
   
3. **TransportFields** - Renders fields based on transport:
   - STDIO: command, args, env
   - HTTP: url, headers
   
4. **DynamicList** - Reusable component for:
   - Args array (add/remove text inputs)
   - Env object (add/remove key-value pairs)

**Testing:**
- Render form in isolation with Storybook or manual test route
- Verify conditional rendering based on transport type
- Test adding/removing dynamic list items
- Verify validation errors display correctly

---

### Step 4: Frontend Page - MCP Manager
**Files:**
- `src/ui/src/pages/MCPManager.tsx` (new)

**What:**
Create main management page following `SatiMemories.tsx` pattern:
- Grid layout displaying `MCPServerCard` for each server
- Search/filter by name and transport type
- "Add Server" button opening modal with `MCPServerForm`
- Loading states with SWR
- Error handling with toast notifications
- Empty state when no servers configured
- Bulk actions [NEEDS CLARIFICATION: Should we support bulk enable/disable or delete?]

**Testing:**
- Navigate to `/mcp-servers` (route not added yet, manual URL)
- Verify grid displays servers correctly
- Test add/edit/delete flows
- Verify enable/disable toggle updates UI and backend

---

### Step 5: Integration - Routing & Navigation
**Files:**
- `src/ui/src/App.tsx` (add route)
- `src/ui/src/components/Layout.tsx` (add nav item)

**What:**
Integrate MCP Manager into application:
- Add route: `<Route path="/mcp-servers" element={<MCPManager />} />`
- Add navigation item with icon (e.g., `Puzzle` from lucide-react)
- Label: "MCP Servers" or "Plugins" [NEEDS CLARIFICATION: Preferred label?]
- Position in sidebar [NEEDS CLARIFICATION: After Config or after Sati Memories?]

**Testing:**
- Click sidebar item and verify navigation works
- Verify breadcrumb/active state highlights
- Test full CRUD workflow end-to-end
- Test on both light and dark themes
- Verify responsive layout on mobile

---

### Step 6: Connection Testing (Optional Enhancement)
**Files:**
- `src/config/mcp-manager.ts` (add testConnection method)
- `src/http/api.ts` (add POST /api/mcp/test/:name)
- `src/ui/src/components/mcp/MCPServerCard.tsx` (add test button)

**What:**
Add connection testing capability:
- Backend spawns MCP server temporarily to verify connectivity
- Returns success/failure status
- UI displays test button per server
- Shows connection status indicator (green/red/gray)

**Testing:**
- Test STDIO server (should spawn process successfully)
- Test HTTP server (should ping URL)
- Test invalid configs (should fail gracefully)
- Verify UI updates connection status

---

## Notes

### Design Decisions
1. **Enable/Disable Pattern**: Using "$" prefix matches existing pattern in user's example
2. **Grid vs Table**: Grid of cards provides better visual hierarchy for MCP configs
3. **Modal vs Inline Forms**: Modal keeps page clean, follows existing `SatiMemories` pattern
4. **Separate Service Layer**: Follows existing architecture (`configService`, `satiService`)

### Future Enhancements (Out of Scope)
- MCP marketplace/discovery
- Auto-detect MCP servers from npm packages
- Import/export MCP configs
- MCP server logs viewer
- Built-in MCP server templates

### Security
- All endpoints protected by `x-architect-pass` header
- Input validation using Zod schemas
- Safe file system operations (atomic writes, backups)

### Accessibility
- Keyboard navigation for all actions
- ARIA labels on form fields
- Screen reader announcements for status changes
