# Quickstart: Morpheus CLI

## Installation

```bash
# Clone repository
git clone https://github.com/placeholder/morpheus.git
cd morpheus

# Install dependencies and link globally
npm install
npm link
```

## Usage

### 1. Initialize & Start
First run automatically creates `~/.morpheus` configuration.

```bash
morpheus start
```
*Output: Agent started on port 3333...*

### 2. Check Status
Open a new terminal:

```bash
morpheus status
# > Morpheus is running (PID: 12345)
```

### 3. Edit Configuration

```bash
morpheus config --edit
```
Edit the `api_key` in the opened file and save.

### 4. Stop Agent

```bash
morpheus stop
# > Agent stopped.
```
