# Tasks: Link Documentation Agent

**Input**: Design documents from `/specs/001-link-doc-agent/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Unit tests are included as per plan.md quality gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [x] T001 Install pdf-parse and mammoth dependencies with `npm install pdf-parse mammoth --legacy-peer-deps`
- [x] T002 [P] Add LinkConfigSchema to `src/config/schemas.ts` BEFORE ConfigSchema (forward-reference rule)
- [x] T003 [P] Add LinkConfig interface to `src/types/config.ts`
- [x] T004 [P] Add 'link' to AuditAgent union in `src/runtime/audit/types.ts`
- [x] T005 [P] Add 'link' to TaskAgent union in `src/runtime/tasks/types.ts`
- [x] T006 Add getLinkConfig() method to `src/config/manager.ts` with env var overrides

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Layer

- [x] T007 Create LinkRepository class in `src/runtime/link-repository.ts` with database initialization
- [x] T008 Implement documents table schema with migrateTable() pattern in `src/runtime/link-repository.ts`
- [x] T009 Implement chunks table schema with CASCADE delete in `src/runtime/link-repository.ts`
- [x] T010 Implement embeddings table schema for sqlite-vec in `src/runtime/link-repository.ts`
- [x] T011 Create FTS5 virtual table for BM25 search in `src/runtime/link-repository.ts`

### Document Processing Utilities

- [x] T012 [P] Create hashDocument() function using SHA-256 in `src/runtime/link-chunker.ts`
- [x] T013 [P] Create chunkText() function with sentence boundary respect in `src/runtime/link-chunker.ts`
- [x] T014 [P] Create parsePDF() function using pdf-parse in `src/runtime/link-chunker.ts`
- [x] T015 [P] Create parseDOCX() function using mammoth in `src/runtime/link-chunker.ts`
- [x] T016 [P] Create parseDocument() dispatcher based on file extension in `src/runtime/link-chunker.ts`

### Repository CRUD Operations

- [x] T017 Implement createDocument() in `src/runtime/link-repository.ts`
- [x] T018 Implement getDocumentByPath() in `src/runtime/link-repository.ts`
- [x] T019 Implement updateDocumentStatus() in `src/runtime/link-repository.ts`
- [x] T020 Implement deleteDocument() with CASCADE cleanup in `src/runtime/link-repository.ts`
- [x] T021 Implement createChunk() and createChunks() batch in `src/runtime/link-repository.ts`
- [x] T022 Implement createEmbedding() and createEmbeddings() batch in `src/runtime/link-repository.ts`

### Link Subagent Skeleton

- [x] T023 Create Link class skeleton with singleton pattern in `src/runtime/link.ts`
- [x] T024 Implement Link.initialize() method in `src/runtime/link.ts`
- [x] T025 Implement Link.getInstance() static method in `src/runtime/link.ts`
- [x] T026 Implement Link.resetInstance() static method in `src/runtime/link.ts`
- [x] T027 Implement Link.setSessionId() static method in `src/runtime/link.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Upload and Index Documentation (Priority: P1) 🎯 MVP

**Goal**: Users can upload documents and have them automatically indexed with chunks and embeddings

**Independent Test**: Upload a PDF/TXT/MD file, verify document appears with "indexed" status

### Tests for User Story 1

- [ ] T028 [P] [US1] Unit test for chunkText() in `src/runtime/__tests__/link-chunker.test.ts`
- [ ] T029 [P] [US1] Unit test for parsePDF() and parseDOCX() in `src/runtime/__tests__/link-chunker.test.ts`
- [ ] T030 [P] [US1] Unit test for LinkRepository CRUD in `src/runtime/__tests__/link-repository.test.ts`

### Implementation for User Story 1

- [x] T031 [US1] Implement LinkWorker class with tick() loop in `src/runtime/link-worker.ts`
- [x] T032 [US1] Implement scanFolder() to list files in ~/.morpheus/docs in `src/runtime/link-worker.ts`
- [x] T033 [US1] Implement processDocument() with hash comparison in `src/runtime/link-worker.ts`
- [x] T034 [US1] Implement indexDocument() orchestrating parse→chunk→embed in `src/runtime/link-worker.ts`
- [x] T035 [US1] Implement generateEmbeddings() reusing Sati infrastructure in `src/runtime/link-worker.ts`
- [x] T036 [US1] Implement removeDeletedDocuments() cleanup in `src/runtime/link-worker.ts`
- [x] T037 [US1] Add LinkWorker initialization to `src/cli/commands/start.ts`
- [x] T038 [US1] Add LinkWorker initialization to `src/cli/commands/restart.ts`
- [x] T039 [US1] Create ~/.morpheus/docs folder on startup in scaffold or start.ts

**Checkpoint**: User Story 1 complete - documents can be indexed automatically

---

## Phase 4: User Story 2 - Search Documentation via Natural Language (Priority: P1)

**Goal**: Users can ask Oracle questions about their documents and receive relevant excerpts

**Independent Test**: Ask Oracle "What does the documentation say about X?" and receive relevant chunks

### Tests for User Story 2

- [ ] T040 [P] [US2] Unit test for hybridSearch() in `src/runtime/__tests__/link-search.test.ts`
- [ ] T041 [P] [US2] Unit test for BM25 normalization in `src/runtime/__tests__/link-search.test.ts`
- [ ] T042 [P] [US2] Unit test for score combination (80/20) in `src/runtime/__tests__/link-search.test.ts`

### Implementation for User Story 2

- [x] T043 [US2] Create LinkSearch class in `src/runtime/link-search.ts`
- [x] T044 [US2] Implement vectorSearch() using sqlite-vec in `src/runtime/link-search.ts`
- [x] T045 [US2] Implement bm25Search() using FTS5 in `src/runtime/link-search.ts`
- [x] T046 [US2] Implement normalizeScores() for BM25 score scaling in `src/runtime/link-search.ts`
- [x] T047 [US2] Implement hybridSearch() combining vector + BM25 with weights in `src/runtime/link-search.ts`
- [x] T048 [US2] Implement search() method in Link class in `src/runtime/link.ts`
- [x] T049 [US2] Implement Link.execute() with search logic in `src/runtime/link.ts`
- [x] T050 [US2] Implement createDelegateTool() using buildDelegationTool() in `src/runtime/link.ts`
- [x] T051 [US2] Add Link.createDelegateTool() to Oracle coreTools in `src/runtime/oracle.ts`
- [x] T052 [US2] Add Link.setSessionId() to Oracle chat() method in `src/runtime/oracle.ts`
- [x] T053 [US2] Add 'link' case to TaskWorker in `src/runtime/tasks/worker.ts`

**Checkpoint**: User Story 2 complete - Oracle can search documentation

---

## Phase 5: User Story 3 - Manage Documents via UI (Priority: P2)

**Goal**: Users can view, upload, and delete documents through a web interface

**Independent Test**: Access Documents page, see list, upload/delete documents

### Backend API for US3

- [x] T054 [P] [US3] Create createLinkRouter() factory in `src/http/routers/link.ts`
- [x] T055 [P] [US3] Implement GET /api/link/documents endpoint in `src/http/routers/link.ts`
- [x] T056 [P] [US3] Implement GET /api/link/documents/:id endpoint in `src/http/routers/link.ts`
- [x] T057 [US3] Implement POST /api/link/documents/upload with multer in `src/http/routers/link.ts`
- [x] T058 [US3] Implement DELETE /api/link/documents/:id endpoint in `src/http/routers/link.ts`
- [x] T059 [US3] Implement POST /api/link/documents/:id/reindex endpoint in `src/http/routers/link.ts`
- [x] T060 [US3] Implement GET/POST /api/link/config endpoints in `src/http/routers/link.ts`
- [x] T061 [US3] Mount link router in `src/http/api.ts`

### Frontend UI for US3

- [x] T062 [P] [US3] Create LinkService with SWR hooks in `src/ui/src/services/link.ts`
- [x] T063 [P] [US3] Create StatusBadge component in `src/ui/src/components/link/StatusBadge.tsx`
- [x] T064 [US3] Create DocumentTable component in `src/ui/src/components/link/DocumentTable.tsx`
- [x] T065 [US3] Create UploadButton component with file input in `src/ui/src/components/link/UploadButton.tsx`
- [x] T066 [US3] Create Documents page in `src/ui/src/pages/Documents.tsx`
- [x] T067 [US3] Add Documents route to router in `src/ui/src/App.tsx` or router config
- [x] T068 [US3] Add Documents link to sidebar navigation in `src/ui/src/components/Layout.tsx`

**Checkpoint**: User Story 3 complete - UI available for document management

---

## Phase 6: User Story 4 - Automatic Document Synchronization (Priority: P2)

**Goal**: System automatically detects file changes, additions, and deletions

**Independent Test**: Add/modify/delete files in docs folder, verify system reflects changes

### Implementation for User Story 4

- [x] T069 [US4] Implement LinkWorker.start() with interval timer in `src/runtime/link-worker.ts`
- [x] T070 [US4] Implement LinkWorker.stop() method in `src/runtime/link-worker.ts`
- [x] T071 [US4] Implement LinkWorker.updateInterval() for hot-reload in `src/runtime/link-worker.ts`
- [x] T072 [US4] Add setInstance()/getInstance() pattern to LinkWorker in `src/runtime/link-worker.ts`
- [x] T073 [US4] Wire LinkWorker.start() on daemon start in `src/cli/commands/start.ts`
- [x] T074 [US4] Wire LinkWorker.stop() on daemon shutdown in `src/cli/commands/start.ts`
- [x] T075 [US4] Implement POST /api/link/worker/scan trigger endpoint in `src/http/routers/link.ts`
- [x] T076 [US4] Implement GET /api/link/worker/status endpoint in `src/http/routers/link.ts`

**Checkpoint**: User Story 4 complete - automatic synchronization working

---

## Phase 7: User Story 5 - Audit Trail for Document Operations (Priority: P3)

**Goal**: Users can see history of document operations and searches

**Independent Test**: Perform searches, view audit timeline showing Link events

### Implementation for User Story 5

- [x] T077 [US5] Implement persistAgentMessage() call in Link.execute() in `src/runtime/link.ts`
- [x] T078 [US5] Add 'link' filter option to global audit page in `src/ui/src/pages/GlobalAudit.tsx`
- [x] T079 [US5] Add verbose mode notification support in Link search in `src/runtime/link.ts`
- [x] T080 [US5] Ensure Link events appear in session audit timeline (inherit from persistAgentMessage)

**Checkpoint**: User Story 5 complete - full audit trail available

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T081 [P] Add error handling for corrupted/unreadable documents in `src/runtime/link-worker.ts`
- [x] T082 [P] Add file size validation (max 50MB) in upload endpoint in `src/http/routers/link.ts`
- [x] T083 [P] Add file type validation in upload endpoint in `src/http/routers/link.ts`
- [x] T084 Add Link documentation section to `CLAUDE.md`
- [x] T085 Add Link configuration to Settings UI in `src/ui/src/pages/Settings.tsx`
- [ ] T086 Run all tests and verify coverage
- [ ] T087 Run linting and fix issues
- [ ] T088 Validate quickstart.md scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (P1) and US2 (P1) can proceed in parallel
  - US3 (P2) and US4 (P2) can proceed in parallel (after US1/US2)
  - US5 (P3) depends on US2 being complete
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational - Backend API needs Repository from Phase 2
- **User Story 4 (P2)**: Can start after Foundational - Needs US1 worker skeleton
- **User Story 5 (P3)**: Depends on US2 (search must work for audit to be meaningful)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/Repository before services
- Services before endpoints/UI
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**: T002-T005 can run in parallel (different files)

**Phase 2 (Foundational)**:
- T012-T016 can run in parallel (chunker utilities)
- T028-T030 can run in parallel (unit tests)

**Phase 3 (US1)**:
- T028-T030 can run in parallel (tests)

**Phase 4 (US2)**:
- T040-T042 can run in parallel (tests)

**Phase 5 (US3)**:
- T054-T056 can run in parallel (read endpoints)
- T062-T063 can run in parallel (UI components)

---

## Parallel Example: Foundational Phase

```bash
# Launch chunker utilities together:
Task: "Create hashDocument() function in src/runtime/link-chunker.ts"
Task: "Create chunkText() function in src/runtime/link-chunker.ts"
Task: "Create parsePDF() function in src/runtime/link-chunker.ts"
Task: "Create parseDOCX() function in src/runtime/link-chunker.ts"
Task: "Create parseDocument() dispatcher in src/runtime/link-chunker.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Document Indexing)
4. Complete Phase 4: User Story 2 (Search)
5. **STOP and VALIDATE**: Test indexing and search end-to-end
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Documents can be indexed (MVP Part 1)
3. Add User Story 2 → Oracle can search docs (MVP Complete!)
4. Add User Story 3 → UI for management (Enhanced UX)
5. Add User Story 4 → Auto-sync (Convenience)
6. Add User Story 5 → Audit trail (Observability)
7. Polish → Production-ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Indexing)
   - Developer B: User Story 2 (Search)
3. Once US1+US2 complete:
   - Developer A: User Story 3 (UI)
   - Developer B: User Story 4 (Worker)
4. Developer C: User Story 5 (Audit)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Link follows the same subagent pattern as Apoc, Neo, Trinity
- Uses separate link.db to isolate document data from session data