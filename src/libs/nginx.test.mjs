import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const nginxConfig = await readFile(new URL('../../nginx.conf', import.meta.url), 'utf8')

function getLocationBlock(path) {
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = nginxConfig.match(
    new RegExp(`location(?: \\^~)? ${escapedPath} \\{([\\s\\S]*?)^    \\}`, 'm')
  )
  assert.ok(match, `expected nginx location for ${path}`)
  return match[1]
}

test('the access log omits query strings and the raw Referer while retaining user-agent', () => {
  const logFormat = nginxConfig.match(/log_format yantube_no_args([\s\S]*?);/)
  assert.ok(logFormat, 'expected yantube_no_args log format')

  assert.doesNotMatch(logFormat[0], /\$http_referer|\$args|\$request_uri/)
  assert.match(logFormat[0], /"\$request_method \$uri \$server_protocol"/)
  assert.match(logFormat[0], /"-" "\$http_user_agent"/)
})

test('real account endpoints use the strict auth limiter without WebSocket upgrade headers', () => {
  const accountLocation = getLocationBlock('/api/account/')
  const genericApiLocation = getLocationBlock('/api/')

  assert.doesNotMatch(nginxConfig, /location(?: \^~)? \/api\/auth\//)
  assert.match(accountLocation, /limit_req zone=auth_limit burst=3 nodelay;/)
  assert.match(accountLocation, /proxy_pass http:\/\/api:9081;/)
  assert.match(accountLocation, /proxy_set_header Host \$host;/)
  assert.match(accountLocation, /proxy_set_header X-Real-IP \$remote_addr;/)
  assert.match(accountLocation, /proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/)
  assert.match(accountLocation, /proxy_set_header X-Forwarded-Proto \$external_scheme;/)
  assert.doesNotMatch(accountLocation, /proxy_set_header (?:Upgrade|Connection) /)

  assert.match(genericApiLocation, /limit_req zone=api_limit burst=10 nodelay;/)
  assert.match(genericApiLocation, /proxy_set_header Upgrade \$http_upgrade;/)
  assert.match(genericApiLocation, /proxy_set_header Connection \$connection_upgrade;/)
})
