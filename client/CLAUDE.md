# Client CLAUDE.md

This file provides guidance to Claude Code when working with the client portion of the MCPJam Inspector.

## Common Commands

### Development

```bash
# Install client dependencies
npm install

# Start client development server
npm run dev

# Format code with Prettier
npm run prettier-fix

# Run ESLint
npm run lint
```

### Building

```bash
# Build client
npm run build
```

### Testing

```bash
# Run client tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Client Architecture

The client is a React frontend application built with TypeScript, Tailwind CSS, and Radix UI, using Vite for building and bundling.

### Core Components

1. **MCPJamAgent (`mcpjamAgent.ts`)**: Central class that manages connections to multiple MCP servers
   - Handles server configuration, connection management, and caching
   - Provides methods for interacting with MCP servers (tools, resources, prompts)
   - Implements caching for better performance

2. **MCPJamClient (`mcpjamClient.ts`)**: Implementation of the MCP client for each server
   - Handles communication with MCP servers via different transport protocols
   - Implements authentication (OAuth, bearer tokens)
   - Manages requests, notifications, and error handling

3. **App (`App.tsx`)**: Main React component that orchestrates the application
   - Manages global state and routing
   - Handles server selection and connection management
   - Renders the main UI components

### UI Organization

The UI is organized into tabs, each focusing on a specific aspect of MCP server interaction:

- **Resource Tab**: Browse and interact with MCP server resources
- **Tools Tab**: Execute MCP server tools with parameter inputs
- **Prompts Tab**: View and use MCP server prompts
- **Chat Tab**: Test LLM tool interactions
- **Console Tab**: View debug logs and errors
- **Settings Tab**: Configure the application

### State Management

State is managed using React hooks and contexts:

1. **McpClientContext**: Provides the current MCP client to components
2. **useServerState**: Manages server configuration and selection
3. **useConnectionState**: Handles connection status and actions
4. **useMCPOperations**: Manages operations with MCP servers
5. **useConfigState**: Handles application configuration

### Key Directories

- `/src/components/`: UI components organized by functionality
- `/src/context/`: React contexts for state management
- `/src/hooks/`: Custom hooks for state and behavior
- `/src/lib/`: Core functionality and types
- `/src/utils/`: Helper functions and utilities

### Data Flow

1. User interacts with UI components
2. Components use hooks to trigger state changes
3. State changes cause appropriate actions in MCPJamAgent/MCPJamClient
4. Agent/Client communicates with MCP servers
5. Results flow back to state, triggering UI updates

### Authentication

The client supports multiple authentication methods:

- OAuth for HTTP-based transports
- Bearer tokens for manual authentication
- Configurable header names for flexibility
