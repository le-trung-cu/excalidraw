import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgrPlugin from 'vite-plugin-svgr'
import path from 'path'
import { fileURLToPath } from 'url'
import { nitro } from 'nitro/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: /^@excalidraw\/common$/,
        replacement: path.resolve(__dirname, "../packages/common/src/index.ts"),
      },
      {
        find: /^@excalidraw\/common\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/common/src/$1"),
      },
      {
        find: /^@excalidraw\/element$/,
        replacement: path.resolve(__dirname, "../packages/element/src/index.ts"),
      },
      {
        find: /^@excalidraw\/element\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/element/src/$1"),
      },
      {
        find: /^@excalidraw\/excalidraw$/,
        replacement: path.resolve(__dirname, "../packages/excalidraw/index.tsx"),
      },
      {
        find: /^@excalidraw\/excalidraw\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/excalidraw/$1"),
      },
      {
        find: /^@excalidraw\/math$/,
        replacement: path.resolve(__dirname, "../packages/math/src/index.ts"),
      },
      {
        find: /^@excalidraw\/math\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/math/src/$1"),
      },
      {
        find: /^@excalidraw\/utils$/,
        replacement: path.resolve(__dirname, "../packages/utils/src/index.ts"),
      },
      {
        find: /^@excalidraw\/utils\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/utils/src/$1"),
      },
      {
        find: /^@excalidraw\/fractional-indexing$/,
        replacement: path.resolve(__dirname, "../packages/fractional-indexing/src/index.ts"),
      },
      {
        find: /^@excalidraw\/laser-pointer$/,
        replacement: path.resolve(__dirname, "../packages/laser-pointer/src/index.ts"),
      },
    ]
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      vite: {
        installDevServerMiddleware: true,
      },
    }),
    nitro(),
    viteReact(),
    svgrPlugin(),
  ],
})

export default config
