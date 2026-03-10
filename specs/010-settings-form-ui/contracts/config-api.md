# API Contract: Configuration Management

## Endpoints

### 1. Get Configuration
Retrieves the current active configuration.

- **URL**: `/api/config`
- **Method**: `GET`
- **Auth**: None (Localhost)
- **Security Note**: Returns raw API keys to allow the UI to display and edit them. This is acceptable for a local-first application where the UI runs on the same machine as the backend. The UI should render these as masked password fields by default.
- **Response**: `200 OK`
  ```json
  {
    "agent": {
      "name": "Morpheus",
      "personality": "Helpful coding assistant"
    },
    "llm": {
      "provider": "ollama",
      "model": "llama3",
      "temperature": 0.7
    },
    ...
  }
  ```

### 2. Update Configuration
Updates the configuration file.

- **URL**: `/api/config`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**: Full `MorpheusConfig` object (see Data Model).
- **Response**: `200 OK`
  ```json
  {
    "status": "success",
    "message": "Configuration saved",
    "config": { ...newConfig }
  }
  ```
- **Error Response**: `400 Bad Request`
  ```json
  {
    "status": "error",
    "error": "Validation failed",
    "details": [
      {
        "path": ["llm", "temperature"],
        "message": "Number must be less than or equal to 1"
      }
    ]
  }
  ```
