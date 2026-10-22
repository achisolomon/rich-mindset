const { defineConfig } = require('@playwright/test');

const PORT = process.env.PORT || 4321;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    command: `python3 -c "import functools; from http.server import HTTPServer, SimpleHTTPRequestHandler; HTTPServer(('127.0.0.1', ${PORT}), functools.partial(SimpleHTTPRequestHandler, directory='.')).serve_forever()"`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
