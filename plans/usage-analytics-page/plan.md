# Usage Analytics Page (MNU-6)

**Branch:** `marcosnunesmbs/mnu-6-mostrar-gastos-por-modelo`  
**Description:** Create a dedicated analytics page showing token usage grouped by provider and model with accordion UI

## Goal

Implement a comprehensive usage analytics page in the Morpheus web UI that displays token consumption statistics grouped by AI provider (OpenAI, Anthropic, Google, Ollama) and model. Users need visibility into which models are consuming the most tokens to understand and optimize their AI usage patterns. This builds on the existing token tracking infrastructure (specs 015, 021) and the basic stats widget (spec 016) by providing granular, organized breakdowns in a dedicated page.

## Implementation Steps

### Step 1: Backend - Add Grouped Statistics Query & API Endpoint
**Files:**
- `src/runtime/memory/sqlite.ts`
- `src/http/api.ts`
- `src/types/stats.ts` (new file)

**What:**  
Add a new database method `getUsageStatsByProviderAndModel()` to SQLiteChatMessageHistory that executes a GROUP BY query returning token usage per provider/model combination. Create a new API endpoint `GET /api/stats/usage/grouped` that calls this method and returns the results. Define TypeScript interfaces for the response structure (ProviderModelUsageStats).

**Details:**
- SQL query: `SELECT provider, model, SUM(input_tokens), SUM(output_tokens), SUM(total_tokens), COUNT(*) FROM messages WHERE provider IS NOT NULL GROUP BY provider, model ORDER BY provider, model`
- Filters out NULL providers to exclude legacy/system messages
- Returns array of objects with provider, model, totalInput, totalOutput, totalTokens, messageCount
- API endpoint follows existing pattern from `/stats/usage`
- Add proper error handling and database connection management

**Testing:**  
- Manually test endpoint with curl/Postman: `curl http://localhost:3000/api/stats/usage/grouped`
- Verify response contains grouped data by provider and model
- Test with empty database (should return empty array)
- Test with messages from multiple providers
- Verify NULL provider messages are excluded

### Step 2: Frontend - Create Custom Accordion Component
**Files:**
- `src/ui/src/components/analytics/ProviderAccordion.tsx` (new file)
- `src/ui/src/components/analytics/ModelStatsCard.tsx` (new file)

**What:**  
Build a custom accordion component since no UI library is available. ProviderAccordion displays provider name and total tokens in the header, with expand/collapse toggle. When expanded, shows child ModelStatsCard components for each model under that provider. Use framer-motion for smooth animations and maintain Matrix theme styling.

**Details:**
- Use React useState for open/closed state
- Framer-motion AnimatePresence for expand/collapse animation
- ChevronDown/ChevronRight icons from lucide-react for toggle indicator
- Header shows: Provider name (capitalized), total tokens across all models
- ModelStatsCard displays: model name, input tokens, output tokens, total tokens, message count
- Apply Matrix theme colors: border-matrix-primary, bg-zinc-950/50, text-matrix-highlight
- Hover effects on accordion header

**Testing:**
- Test expand/collapse animation smoothness
- Verify clicking header toggles accordion
- Test with single model vs multiple models per provider
- Verify all token numbers display correctly with locale formatting (commas)
- Test responsive layout on different screen sizes

### Step 3: Frontend - Create Analytics Page with Data Fetching
**Files:**
- `src/ui/src/pages/Analytics.tsx` (new file)
- `src/ui/src/services/statsService.ts`

**What:**  
Create a new Analytics page component that fetches grouped usage data via SWR and renders ProviderAccordion components for each provider. Add a new method `fetchGroupedUsageStats()` to statsService that calls the `/api/stats/usage/grouped` endpoint. Transform the flat API response into a nested structure grouped by provider.

**Details:**
- SWR hook with 5-second refresh interval (consistent with existing stats widget)
- Data transformation: group flat array by provider, calculate provider totals
- Loading state: Show skeleton/spinner while fetching
- Error state: Display error message with retry option
- Empty state: Show friendly message when no usage data exists
- Page layout: Full-width container with proper spacing
- Sort providers alphabetically
- Display page title and description

**Testing:**
- Test page renders with real data
- Verify SWR auto-refresh works (modify database, check UI updates)
- Test loading state by throttling network in DevTools
- Test error state by stopping backend server
- Test empty state with fresh database
- Verify data transformation groups correctly by provider
- Test with 1 provider, multiple providers, many models per provider

### Step 4: Frontend - Add Navigation & Route
**Files:**
- `src/ui/src/App.tsx`
- `src/ui/src/components/Layout.tsx`

**What:**  
Register the Analytics page in the React Router routes and add a navigation item to the sidebar menu. Use the BarChart3 or TrendingUp icon from lucide-react. Position the nav item between Dashboard and Configuration for logical flow (Dashboard → Analytics → Configuration → Logs).

**Details:**
- Add route: `<Route path="/analytics" element={<Analytics />} />`
- Import Analytics component in App.tsx
- Add to navItems array in Layout.tsx: `{ icon: BarChart3, label: 'Analytics', path: '/analytics' }`
- Ensure active state highlighting works (existing pattern in Layout)
- Verify icon displays correctly in sidebar

**Testing:**
- Navigate to /analytics from browser address bar - page should load
- Click Analytics nav item in sidebar - should navigate to page
- Verify active state highlights Analytics in sidebar when on the page
- Test navigation between all pages (Dashboard → Analytics → Config → Logs)
- Verify browser back/forward buttons work correctly

### [NEEDS CLARIFICATION] Step 5: Data Presentation & UX Enhancements
**Files:**
- `src/ui/src/pages/Analytics.tsx`
- `src/ui/src/components/analytics/ProviderAccordion.tsx`

**What:**  
Add enhancements to improve usability and data presentation. [NEEDS CLARIFICATION]

**Questions:**
1. **Provider Name Formatting:** Should we display provider keys as-is (lowercase: "openai", "anthropic") or use friendly names ("OpenAI", "Anthropic Claude", "Google Gemini")? If friendly names, please provide preferred mappings.

2. **Default Accordion State:** Should all accordions be closed by default, all open, or just the first one open?

3. **Sorting Options:** Should providers be sorted alphabetically, by total token usage (highest first), or let users toggle sort order?

4. **Time Range Filtering:** The backend already supports time range filtering (used in TokenUsageTool). Should we add date range filtering to this page (e.g., "Last 7 days", "Last 30 days", "All time" buttons)?

5. **Cost Calculation:** Should we display estimated costs based on token usage? If yes, we need pricing data for each provider/model (e.g., GPT-4o = $2.50/1M input + $10/1M output). This is not in the original spec but the data structure supports it.

6. **Export Functionality:** Should users be able to export usage data as CSV for external analysis?

7. **Unknown Provider Handling:** Messages with NULL provider/model will be filtered out. Should we show these in a separate "Unknown" section or keep them hidden?

**Testing:** (Will be defined after clarifications are provided)

## Technical Notes

### Database Infrastructure
- All required columns already exist: `provider`, `model`, `input_tokens`, `output_tokens`, `total_tokens` (added in specs 015 and 021)
- SQLite GROUP BY query is efficient even with large datasets
- Existing migration logic handles schema updates gracefully

### UI Component Architecture
- No UI component library available (no shadcn, radix, headlessui)
- Must build custom accordion using React state + framer-motion
- Follows existing patterns from Settings page (tabs) and Dashboard (cards)
- Matrix theme fully defined and ready to use

### Data Flow
1. API endpoint → statsService.fetchGroupedUsageStats() → SWR hook → Analytics page
2. Data transformation: Flat array → Grouped by provider → Sorted → Rendered as accordions
3. Auto-refresh every 5 seconds (consistent with existing stats widget)

### Performance Considerations
- SQL GROUP BY is very efficient (tested with SQLite)
- SWR caching prevents unnecessary re-fetches
- Framer-motion animations are GPU-accelerated
- Lazy rendering: Only expanded accordions render child components

### Dependencies
- No new dependencies required
- Uses existing: React, framer-motion, lucide-react, SWR, tailwindcss

## Acceptance Criteria

- [ ] Backend endpoint `/api/stats/usage/grouped` returns token usage grouped by provider and model
- [ ] Analytics page accessible at `/analytics` route
- [ ] Navigation item appears in sidebar with correct icon
- [ ] Accordion UI shows providers with expand/collapse functionality
- [ ] Each provider shows total token usage across all models
- [ ] Expanded accordions display individual models with input/output/total tokens
- [ ] Token numbers formatted with locale (commas for readability)
- [ ] Page auto-refreshes every 5 seconds to show live data
- [ ] Loading, error, and empty states handled gracefully
- [ ] Smooth animations on accordion expand/collapse
- [ ] Consistent Matrix theme styling throughout
- [ ] Responsive design works on different screen sizes
- [ ] NULL provider messages excluded from display

## Related Specifications

- **Spec 015** (`persist-tool-usage`) - Added token columns to messages table
- **Spec 021** (`db-msg-provider-model`) - Added provider/model columns
- **Spec 016** (`ui-config-stats`) - Created initial usage stats widget
- **Spec 020** (`morpheus-tools-integration`) - Created analytics tools (TokenUsageTool)
- **Spec 009** (`web-ui-dashboard`) - UI page creation pattern
- **Spec 010** (`settings-form-ui`) - Form/section component patterns

## Future Enhancements (Out of Scope for This PR)

- Cost calculation and display based on provider pricing
- Date range filtering (Last 7 days, Last 30 days, All time)
- CSV export of usage statistics
- Charts/graphs for visual representation
- Comparison between time periods
- Model usage trends over time
