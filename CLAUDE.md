# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Start development servers (client + server)
npm run dev

# For Windows development
npm run dev:windows

# Format code with Prettier
npm run prettier-fix

# Clean all build artifacts and reinstall
npm run clean
```

### Building
```bash
# Build all components
npm run build

# Build individual components
npm run build-server
npm run build-client
npm run build-cli

# Test the build
npm run start
```

### Testing
```bash
# Run all tests
npm run test

# Run CLI tests
npm run test-cli

# Run tests in watch mode (client only)
cd client && npm run test:watch
```

### Linting
```bash
# Check code formatting
npm run prettier-check

# Run ESLint (client-specific)
cd client && npm run lint
```

### Running
```bash
# Start the MCP Inspector
npm run start

# Run as a package
npm run run-package

# Connect to a local server
npm run run-package -- node build/index.js

# Connect with custom arguments
npm run run-package -- node server.js --port 3000 --debug

# Load servers from a config file
npm run run-package -- --config ./my-config.json
```

## Architecture Overview

The MCPJam Inspector is built as a monorepo with three main components:

1. **Client (`/client`)**: React frontend application with TypeScript
   - Uses React 18, TypeScript, Tailwind CSS, and Radix UI
   - Vite for building and bundling
   - Handles the user interface for interacting with MCP servers

2. **Server (`/server`)**: Express.js backend with WebSocket support
   - Acts as a proxy between the frontend client and MCP servers
   - Handles different transport protocols (STDIO, SSE, Streamable HTTP)
   - Manages connections to MCP servers

3. **CLI (`/cli`)**: Command-line interface for launching the inspector
   - Entry point for users through `mcp-inspector` command
   - Handles configuration and startup for both client and server
   - Supports connecting to existing MCP servers

### Key Architecture Concepts

- **Transports**: The server supports multiple transport protocols for communicating with MCP servers:
  - STDIO: For spawning and communicating with local MCP server processes
  - SSE (Server-Sent Events): For connecting to remote MCP servers
  - Streamable HTTP: For HTTP-based MCP servers

- **MCP Agent**: Manages connections to multiple MCP servers, handles requests/responses, and provides a unified interface for the client
  - `MCPJamAgent`: Central class managing MCP server connections
  - `MCPJamClient`: Implementation of the MCP client for each server

- **UI Components**: Organized by functionality in tabs:
  - Resources Tab: View and interact with MCP server resources
  - Tools Tab: Execute MCP server tools with parameter input
  - Prompts Tab: Work with MCP server prompts
  - Chat Tab: Test LLM tool interactions
  - Console Tab: View debug logs

### Data Flow

1. User interacts with the Client UI
2. Client sends requests through the MCP Agent
3. Server proxies these requests to the appropriate MCP server
4. MCP server responds, and the Server forwards responses back to the Client
5. Client renders results in the UI

### Configuration

- Server configurations can be saved in JSON format (see sample-config.json)
- Supports environment variables for customization
- OAuth integration for authenticated connections
- Multiple server connections can be managed simultaneously

### React Component Structure

- Uses React contexts for managing state:
  - `McpClientContext`: Provides the current MCP client to components
  - Custom hooks like `useServerState`, `useConnectionState`, and `useMCPOperations` for managing application state

### Key Files and Directories

- `/client/src/App.tsx`: Main React application component
- `/client/src/mcpjamAgent.ts`: Core agent managing MCP server connections
- `/client/src/mcpjamClient.ts`: Implementation of the MCP client
- `/client/src/components/`: UI components organized by functionality
- `/server/src/mcpProxy.ts`: Server-side proxy for MCP communications
- `/cli/src/cli.ts`: CLI entry point for launching the inspector

## Development Workflow

1. Start the development servers with `npm run dev`
2. Make changes to client or server code
3. Test changes in browser at http://localhost:6274
4. Format code with `npm run prettier-fix` before committing
5. Run tests with `npm test`