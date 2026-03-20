/**
 * lib/server.js — Minimal MCP server (stdio transport)
 */
export function createServer({ name, version, tools }) {
  return {
    start() {
      process.stdin.setEncoding('utf8')
      let buffer = ''

      process.stdin.on('data', (chunk) => {
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop()
        lines.forEach(line => {
          if (line.trim()) handleMessage(line.trim())
        })
      })

      async function handleMessage(raw) {
        let msg
        try { msg = JSON.parse(raw) } catch { return }

        if (msg.method === 'initialize') {
          respond(msg.id, {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name, version },
          })
        } else if (msg.method === 'tools/list') {
          respond(msg.id, {
            tools: Object.entries(tools).map(([toolName, tool]) => ({
              name: toolName,
              description: tool.description,
              inputSchema: tool.inputSchema,
            })),
          })
        } else if (msg.method === 'tools/call') {
          const { name: toolName, arguments: args } = msg.params
          const tool = tools[toolName]
          if (!tool) {
            respondError(msg.id, `Unknown tool: ${toolName}`)
            return
          }
          try {
            const result = await tool.handler(args || {})
            respond(msg.id, {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            })
          } catch (err) {
            respondError(msg.id, err.message)
          }
        }
      }

      function respond(id, result) {
        const msg = JSON.stringify({ jsonrpc: '2.0', id, result })
        process.stdout.write(msg + '\n')
      }

      function respondError(id, message) {
        const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message } })
        process.stdout.write(msg + '\n')
      }
    }
  }
}
