# Research: Web UI Dashboard

## 1. Serving Vite App from Node.js CLI

**Problem**: How to package and serve the React UI within the existing CLI daemon?

**Options**:
A. **Spawn separate process**: Run `vite preview` or a separate server. (Heavy, requires user to have installed deps?).
B. **Embedded Static Server**: Build the React app to static files (`ui/dist`) and serve them using `express.static` in the main daemon process.

**Decision**: **Option B**.
- **Rationale**: Single process to manage. No extra dependencies for the user (static files are committed or built during npm install).
- **Implementation**:
    - Build output goes to `dist/ui`.
    - Express middleware: `app.use(express.static(path.join(__dirname, '../ui')))` (path depends on build structure).
    - Catch-all route for SPA: `res.sendFile('index.html')`.

## 2. API & Log Access

**Problem**: How to efficiently read logs?

**Findings**:
- Logs are in `~/.morpheus/logs/morpheus-YYYY-MM-DD.log`.
- `winston` writes them.
- **Reading**: `fs.readFile` is sufficient for small text files. If logs are huge, `createReadStream` or reading bytes from the end is better.
- **Requirement**: "Recent 50 lines".
- **Decision**: Read the full file (files rotate daily, so shouldn't be massive) and slice the last 50 lines in memory for MVP. Improve to stream if performance issues arise.

## 3. Tailwind Theme Configuration

**Problem**: Exact color match for "Matrix" theme.

**Solution**:
Extend strictly in `tailwind.config.js`:
```javascript
theme: {
  extend: {
    colors: {
      matrix: {
        darkest: '#0D0D0D', // Background
        dark: '#04060D',    // Dark Mode Background
        base: '#13402B',
        mid: '#1D733B',
        light: '#4ED963',
        lightest: '#9AF28D',
        white: '#ffffff'
      }
    }
  }
}
```

## 4. Project Structure

**Decision**:
```
morpheus/
  src/
    http/        <-- New: Express server
    ui/          <-- New: React App source
  ui-build/      <-- New: Output of UI build (copy to dist/ui)
```
*Correction*: Vite usually builds to a dist folder. We can configure Vite to build to `../dist/ui` so it sits alongside the compiled TS code.

**Updated Build Flow**:
1. `tsc` builds `src/` -> `dist/`
2. `vite build` builds `src/ui` -> `dist/ui`
3. `npm start` runs `dist/cli/index.js` (which requires `../http/server` which serves `../ui`).
