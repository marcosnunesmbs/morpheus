# Quickstart: Publishing Morpheus

## Prerequisites

- npm account logged in (`npm login`)
- Project built successfully (`npm run build`)

## How to Publish

1. **Bump Version**:
   ```bash
   npm version patch  # or minor/major
   ```

2. **Publish**:
   ```bash
   npm publish
   ```
   *Note: This will automatically run `npm run build` due to the `prepublishOnly` script.*

## How to Install (User)

```bash
npm install -g morpheus-cli
```

## How to Use

1. **Start Agent & UI**:
   ```bash
   morpheus start
   ```
   *Opens UI at http://localhost:3333*

2. **Run Config**:
   ```bash
   morpheus config
   ```

## Development Testing

To test the package locally as if it were installed globally:

```bash
# In project root
npm install -g .
```
