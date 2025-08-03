#!/usr/bin/env node

import { spawn } from 'child_process'
import { setTimeout } from 'timers/promises'
import { existsSync } from 'fs'

console.log('🧪 Testing Phase 1 Migration Setup...\n')

// Test 1: Check if build outputs exist
const clientBuilt = existsSync('./dist/client/index.html')
const serverBuilt = existsSync('./dist/server/index.cjs')

console.log('📦 Build Outputs:')
console.log(`  Client: ${clientBuilt ? '✅' : '❌'} dist/client/index.html`)
console.log(`  Server: ${serverBuilt ? '✅' : '❌'} dist/server/index.cjs`)

if (!clientBuilt || !serverBuilt) {
  console.log('\n❌ Build outputs missing. Run `npm run build` first.')
  process.exit(1)
}

// Test 2: Start server and test endpoints
console.log('\n🚀 Starting server...')
const server = spawn('node', ['dist/server/index.cjs'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: '3002' }
})

server.stdout.on('data', (data) => {
  console.log(`  ${data.toString().trim()}`)
})

server.stderr.on('data', (data) => {
  console.log(`  Error: ${data.toString().trim()}`)
})

// Wait for server to start
await setTimeout(2000)

// Test 3: Check endpoints
console.log('\n🔍 Testing API endpoints...')

const tests = [
  { path: '/health', expected: 'ok' },
  { path: '/api/mcp/health', expected: 'ready' },
  { path: '/api/mcp/tools', expected: 'placeholder' }
]

for (const test of tests) {
  try {
    const response = await fetch(`http://localhost:3002${test.path}`)
    const data = await response.json()
    const success = data.status === test.expected
    console.log(`  ${test.path}: ${success ? '✅' : '❌'} ${data.status || 'error'}`)
  } catch (error) {
    console.log(`  ${test.path}: ❌ ${error.message}`)
  }
}

// Test 4: Check static file serving
console.log('\n📁 Testing static file serving...')
try {
  const response = await fetch('http://localhost:3002/')
  const success = response.ok
  console.log(`  Static files: ${success ? '✅' : '❌'} ${response.status}`)
} catch (error) {
  console.log(`  Static files: ❌ ${error.message}`)
}

console.log('\n🎉 Phase 1 Migration Test Complete!')
console.log('\n📋 Next Steps:')
console.log('  • Phase 2: Port simple MCP endpoints (/connect, /tools, /resources)')
console.log('  • Phase 3: Port complex chat streaming (/chat)')
console.log('  • Phase 4: Move React components to Vite')

// Cleanup
server.kill()
process.exit(0)