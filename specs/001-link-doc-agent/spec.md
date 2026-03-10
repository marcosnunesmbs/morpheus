# Feature Specification: Link Documentation Agent

**Feature Branch**: `001-link-doc-agent`
**Created**: 2026-03-03
**Status**: Draft
**Input**: User description: "Link é um novo agente especialista em documentação. Cria uma pasta .morpheus/docs, um worker busca documentos, faz hash para detectar mudanças, executa chunk e cria vetores. Fornece ao Oracle informações via RAG (vetorial 80% + BM25 20%) com score configurável. Segue padrão de auditoria e notificação verbosa."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload and Index Documentation (Priority: P1)

As a user, I want to upload documents to the system so they can be automatically processed and made searchable for future queries.

**Why this priority**: This is the foundational capability - without documents indexed, no search can be performed. This is the core entry point for the feature.

**Independent Test**: Can be fully tested by uploading a PDF/TXT/MD file through the UI or placing it in the docs folder, then verifying the document appears in the management list with "indexed" status.

**Acceptance Scenarios**:

1. **Given** the docs folder is empty, **When** I upload a PDF document through the UI, **Then** the document is stored and its status shows "indexing" then "indexed"
2. **Given** a document exists in the docs folder, **When** the worker runs its scan, **Then** the document is detected, hashed, chunked, and vectorized
3. **Given** a document was previously indexed, **When** I replace the file with a modified version, **Then** the system detects the hash change and re-indexes the document
4. **Given** a document is being indexed, **When** the process completes, **Then** the UI shows "indexed" status with chunk count

---

### User Story 2 - Search Documentation via Natural Language (Priority: P1)

As a user, I want to ask questions about my documents and receive relevant excerpts, so I can find information without manually reading all files.

**Why this priority**: This is the primary value proposition - enabling natural language queries over documentation. Without this, indexing serves no purpose.

**Independent Test**: Can be fully tested by asking Oracle a question like "What does the documentation say about X?" and receiving relevant document excerpts in the response.

**Acceptance Scenarios**:

1. **Given** documents are indexed, **When** I ask Oracle "What does the documentation say about authentication?", **Then** Link performs a hybrid search and returns the most relevant chunks
2. **Given** a query is submitted, **When** Link processes it, **Then** results are ranked by combined vector (80%) and BM25 (20%) scores
3. **Given** search results are found, **When** they exceed the score threshold, **Then** only chunks above the threshold are returned to Oracle
4. **Given** no relevant documents exist, **When** a query is made, **Then** the system responds that no matching documentation was found

---

### User Story 3 - Manage Documents via UI (Priority: P2)

As a user, I want to view, upload, and delete documents through a web interface, so I can manage my documentation library easily.

**Why this priority**: Enhances usability but the core functionality works via file system. Power users can use file operations directly.

**Independent Test**: Can be fully tested by accessing the Documents page in the UI, seeing the list of indexed documents, and performing upload/delete operations.

**Acceptance Scenarios**:

1. **Given** I access the Documents page, **When** the page loads, **Then** I see all documents with their status (indexing, indexed, error), file size, and chunk count
2. **Given** I want to add a document, **When** I click upload and select a file, **Then** the file is uploaded to the docs folder and indexing begins
3. **Given** a document is listed, **When** I click delete, **Then** the document is removed from storage and all its chunks/vectors are deleted
4. **Given** a document is indexing, **When** I view the list, **Then** I see a progress indicator or "indexing" status

---

### User Story 4 - Automatic Document Synchronization (Priority: P2)

As a user, I want the system to automatically detect when I add, modify, or remove documents from the docs folder, so my documentation library stays current without manual intervention.

**Why this priority**: Ensures data consistency but the system works without it if users trigger scans manually.

**Independent Test**: Can be fully tested by adding/modifying/deleting files in the docs folder and verifying the system reflects those changes automatically.

**Acceptance Scenarios**:

1. **Given** the worker is running, **When** I add a new file to the docs folder, **Then** on the next scan cycle, the file is detected and indexed
2. **Given** an indexed document is deleted from the folder, **When** the worker scans, **Then** all database records (document, chunks, vectors) for that file are removed
3. **Given** an indexed document is modified, **When** the worker scans, **Then** the hash change is detected and the document is re-indexed
4. **Given** multiple files change simultaneously, **When** the worker processes them, **Then** all changes are handled in a single scan cycle

---

### User Story 5 - Audit Trail for Document Operations (Priority: P3)

As a user, I want to see a history of document operations and searches, so I can track how the documentation system is being used.

**Why this priority**: Useful for observability but not essential for core functionality.

**Independent Test**: Can be fully tested by performing document operations and searches, then viewing the audit timeline in the UI.

**Acceptance Scenarios**:

1. **Given** a document search is performed, **When** the operation completes, **Then** an audit event is recorded with query, results count, and duration
2. **Given** I view a session's audit timeline, **When** Link was involved, **Then** I see Link events with query details and matched chunks
3. **Given** I view the global audit page, **When** filtering by Link agent, **Then** I see all Link operations across sessions
4. **Given** verbose mode is enabled, **When** Link performs a search, **Then** a notification is sent to the originating channel

---

### Edge Cases

- What happens when a document file is corrupted or unreadable? The system logs an error, marks the document status as "error", and continues processing other documents.
- What happens when the docs folder doesn't exist? The system creates it automatically on startup.
- What happens when the embedding provider is unavailable during indexing? The system retries with exponential backoff and marks the document as "pending" until successful.
- What happens when a search query is empty or malformed? The system returns an appropriate error message without performing the search.
- What happens when a document exceeds maximum file size? The system rejects the document and shows an error in the UI.
- What happens when chunking produces zero chunks (empty file)? The system logs a warning and marks the document as "indexed" with zero chunks.

## Requirements *(mandatory)*

### Functional Requirements

**Document Management**

- **FR-001**: System MUST create a dedicated folder for document storage at `.morpheus/docs` if it does not exist
- **FR-002**: System MUST support common document formats including PDF, TXT, MD, and DOCX
- **FR-003**: System MUST calculate a content hash for each document to detect changes
- **FR-004**: System MUST track document metadata including filename, file size, hash, status, and timestamps
- **FR-005**: System MUST automatically remove all associated data (chunks, vectors) when a document file is deleted

**Document Processing**

- **FR-006**: System MUST chunk documents into configurable segment sizes (default 500 characters)
- **FR-007**: System MUST create vector embeddings for each chunk using the configured embedding provider
- **FR-008**: System MUST persist chunks with their associated document reference, position, and content
- **FR-009**: System MUST detect document modifications via hash comparison and trigger re-indexing
- **FR-010**: System MUST handle indexing failures gracefully without blocking other documents

**Search and Retrieval**

- **FR-011**: System MUST perform hybrid search combining vector similarity (80% weight) and BM25 text search (20% weight)
- **FR-012**: System MUST filter results by a configurable score threshold (0.0 to 1.0)
- **FR-013**: System MUST return matching chunks with their source document reference and relevance score
- **FR-014**: System MUST limit the number of returned chunks to prevent context overflow

**Agent Integration**

- **FR-015**: System MUST provide a search tool for Oracle to query documentation when users request information
- **FR-016**: System MUST support both synchronous and asynchronous execution modes as configured
- **FR-017**: System MUST follow the established subagent pattern with singleton instance and delegation tool
- **FR-018**: System MUST integrate with the existing verbose mode notification system

**Configuration**

- **FR-019**: System MUST allow configuration of chunk size via the configuration file
- **FR-020**: System MUST allow configuration of search score threshold via the configuration file
- **FR-021**: System MUST support standard LLM configuration options (provider, model, temperature, API key)
- **FR-022**: System MUST allow configuration of execution mode (sync/async)

**Audit and Observability**

- **FR-023**: System MUST record audit events for all search operations
- **FR-024**: System MUST integrate with the session audit timeline
- **FR-025**: System MUST appear in the global audit page when filtering by agent type

**User Interface**

- **FR-026**: System MUST provide a Documents management page in the web UI
- **FR-027**: System MUST allow file upload through the UI
- **FR-028**: System MUST display document list with status, size, and chunk count
- **FR-029**: System MUST allow document deletion through the UI
- **FR-030**: System MUST show vectorization status indicator for each document

### Key Entities

- **Document**: Represents an uploaded file with metadata (filename, path, hash, size, status, created_at, updated_at). Status can be: pending, indexing, indexed, error.

- **Chunk**: A segment of document content with position index, content text, and reference to its parent document. Used for both search and retrieval.

- **Embedding**: Vector representation of a chunk stored for similarity search. Linked to a specific chunk record.

- **LinkConfig**: Configuration settings for the Link agent including LLM settings, chunk_size, score_threshold, and execution_mode.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can upload a document and have it searchable within 60 seconds for files under 1MB
- **SC-002**: Search queries return relevant results within 3 seconds for libraries up to 10,000 chunks
- **SC-003**: System correctly identifies and re-indexes modified documents within one scan cycle
- **SC-004**: Deleted documents have all associated data (chunks, vectors) removed within one scan cycle
- **SC-005**: Hybrid search (vector + BM25) returns more relevant results than vector-only search for the same query
- **SC-006**: Users can view document status and manage their documentation library without technical knowledge
- **SC-007**: Audit trail captures all Link operations with sufficient detail for debugging and usage analysis
- **SC-008**: System maintains 99.9% uptime for search queries even during indexing operations

## Assumptions

- The embedding provider uses the same infrastructure as the existing Sati memory system (sqlite-vec)
- Documents are expected to be text-heavy; image-heavy PDFs may not produce useful search results
- The default chunk size of 500 characters is suitable for most document types; users can adjust as needed
- Users understand that search quality depends on document quality and clarity
- The worker scan interval will be configurable but defaults to a reasonable frequency (e.g., every 30 seconds)
- File uploads are limited to a reasonable maximum size (e.g., 50MB) to prevent resource exhaustion