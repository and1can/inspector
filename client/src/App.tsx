import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">MCP Inspector</h1>
        <div className="card">
          <button 
            onClick={() => setCount((count) => count + 1)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            count is {count}
          </button>
          <p className="mt-4 text-muted-foreground">
            Click the button to test React functionality
          </p>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Phase 1 Migration: Hono + Vite foundation is ready!<br/>
          Frontend: http://localhost:8080 | Backend: http://localhost:8001
        </p>
      </div>
    </div>
  )
}

export default App