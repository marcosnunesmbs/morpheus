# Contributing to Morpheus

Thank you for your interest in contributing to Morpheus! This document provides guidelines for developing and contributing to the project.

## 🛠 Getting Started

1.  **Clone & Install**
    ```bash
    git clone <repository-url>
    cd morpheus
    npm install
    ```

2.  **Running Locally**
    - **Backend (Daemon):** Run the CLI daemon.
      ```bash
      npm start -- start
      # Or for development with watch mode:
      npm run dev
      ```
    - **Frontend (Web UI):** Run the Vite dev server.
      ```bash
      npm run dev --prefix src/ui
      ```

3.  **Building**
    - Full build (Backend + Frontend): `npm run build`
    - Run tests: `npm test`

## 📝 Specification-Driven Development

We follow a strict **Spec-Driven Development** workflow. All major features must originate in the `specs/` directory.

1.  **Create a Spec:** Start a new folder `specs/NNN-feature-name/`.
2.  **Required Files:**
    -   `spec.md`: Functional requirements (source of truth).
    -   `plan.md`: Technical implementation strategy.
    -   `tasks.md`: Checklist of implementation steps.
    -   `contracts/`: Define TypeScript interfaces *before* writing code.
3.  **Process:** Read the spec -> Update the plan -> Implement -> Check off tasks.

## 💻 Coding Standards

### TypeScript & ESM
- **Native ESM:** This project uses native ESM. **Relative imports MUST include the `.js` extension**.
  ```typescript
  // ✅ Correct
  import { Foo } from './foo.js';
  // ❌ Incorrect
  import { Foo } from './foo';
  ```
- **Verbatim Module Syntax:** Use `import type` where appropriate.

### Architecture Patterns
- **Directory Structure:**
  -   `src/cli/`: Command definitions.
  -   `src/runtime/`: Core agent logic.
  -   `src/channels/`: Input/output adapters (e.g., Telegram).
  -   `src/http/`: Express server and API.
  -   `src/ui/`: React + Vite frontend.
- **Singletons:** Use `ConfigManager.getInstance()` and `DisplayManager.getInstance()` for global concerns.
- **Error Handling:** Log errors to `DisplayManager`, not `console.error`.

## 🚀 Submitting a Pull Request

1.  Ensure your feature follows a specific Spec ID.
2.  Verify that `npm run build` succeeds.
3.  Run `npm test` to ensure no regressions.
4.  Update the `tasks.md` in your spec folder to reflect completed work.
