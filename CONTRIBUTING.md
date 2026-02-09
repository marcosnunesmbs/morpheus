# Contributing to Morpheus

We welcome contributions! To ensure a smooth collaboration, please follow these guidelines.

## 1. Development Setup

### Prerequisites
*   Node.js (v20 or higher)
*   npm
*   Git

### Initial Setup
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/marcosnunesmbs/morpheus.git
    cd morpheus
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start Development Mode:**
    *   **Backend (CLI/Daemon):**
        ```bash
        npm run dev:cli
        # This runs `npx tsx watch src/cli/index.ts -- start`
        ```
    *   **Frontend (Web UI):**
        ```bash
        npm run dev:ui
        ```

## 2. Specification-Driven Development
We follow a strict **Spec-Driven** workflow. Code is the final output of a thought process, not the start.

1.  **Start with a Spec:**
    *   Create a new directory in `specs/NNN-feature-name/`.
    *   Add `spec.md` (Requirements) and `plan.md` (Technical implementation).
2.  **Define Contracts:**
    *   If adding new internal APIs, define TypeScript interfaces in `src/types/` or `contracts/` first.
3.  **Implement & Verify:**
    *   Follow the tasks outlined in your `tasks.md`.

## 3. Branching Strategy
*   **`main`**: The stable production branch.
*   **Feature Branches**: Create branches from `main` using the format:
    *   `feat/feature-name`
    *   `fix/bug-description`
    *   `docs/documentation-update`

## 4. Code Style & Standards

### TypeScript
*   **Strict Mode:** We use strict TypeScript configuration. Avoid `any` whenever possible.
*   **ES Modules:** Use native ESM syntax. **Relative imports must end with `.js`**.
    *   ✅ `import { start } from './lifecycle.js';`
    *   ❌ `import { start } from './lifecycle';`

### Linting & Formatting
*   Run the linter before committing:
    ```bash
    npm run lint
    # (Assuming lint script exists, if not, follow standard ESLint/Prettier practices)
    ```

## 5. Commit Messages
We use **Semantic Commits** (Conventional Commits):

*   `feat: add support for Discord channel`
*   `fix: resolve memory leak in Sati middleware`
*   `docs: update ARCHITECTURE.md`
*   `chore: upgrade dependencies`
*   `refactor: simplify provider factory`

## 6. Pull Request Guidelines
1.  **Title:** Use the Semantic Commit format.
2.  **Description:** Reference the Spec ID or Issue ID related to the change.
3.  **Checklist:**
    *   [ ] `npm run build` passes locally.
    *   [ ] `npm test` passes.
    *   [ ] No new linting errors.
    *   [ ] Documentation updated (if applicable).

## 7. Testing Requirements
*   **Unit Tests:** Place tests in `__tests__` folders alongside the code being tested.
*   **Running Tests:**
    ```bash
    npm test
    ```
*   Ensure critical logic (Runtime, Memory) has adequate coverage.

## 8. Documentation
*   Keep internal documentation (comments) clear.
*   Update `PRODUCT.md` or `README.md` if user-facing features change.
*   Update `ARCHITECTURE.md` if system structural changes occur.
