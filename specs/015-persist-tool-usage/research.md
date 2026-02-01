# Research: Usage Metadata & Persistence

## Unknowns & Clarifications

### 1. Google GenAI Usage Metadata
**Question**: How to access consumption (tokens) for Audio Agent (Gemini)?
**Findings**: The `@google/genai` SDK returns a `GenerateContentResponse` which contains `usageMetadata`.
- Fields: `promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`.
- Note: Cached content tokens are in `cachedContentTokenCount`.
**Decision**: We will extract these properties from the `response.usageMetadata` object in `AudioAgent`.

### 2. LangChain Tool Message Persistence
**Question**: Does `SQLiteChatMessageHistory` support `ToolMessage`?
**Findings**: `better-sqlite3` storage is custom implemented in this project. Currently `addMessage` throws on unsupported types.
**Decision**: We need to explicitly add support for `ToolMessage` type string in the `addMessage` switch case and storage logic.

## Technology Choices

| Area | Choice | Rationale |
|------|--------|-----------|
| DB Migration | Check & Alter | Simple for SQLite single-operator deployment. No heavy migration tool needed yet. |
| Metadata | Columns | Adding columns (`input_tokens` etc) is more queryable than a JSON blob. |
