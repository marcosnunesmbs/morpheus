## Why

The MNU-13 issue requires implementing a UI page to display Sati memories, allowing users to view and manage their long-term memory entries. This addresses the need for transparency and user control over the AI's memory of conversations and data.

## What Changes

- Create a new UI page called "Sati" to display user memories
- Implement a table view showing all memories stored by the Sati middleware
- Add functionality to allow users to delete individual or multiple memories
- Create necessary API endpoints to fetch and delete memory entries

## Capabilities

### New Capabilities
- `sati-memories-ui`: A new UI capability to display and manage Sati memories
- `sati-memory-api`: API endpoints to retrieve and manipulate Sati memory entries

### Modified Capabilities

## Impact

- New UI route and components in the React dashboard
- New API endpoints in the Express server
- Integration with the Sati memory middleware
- Database queries to fetch and delete memory entries from SQLite