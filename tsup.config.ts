import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/ai-sdk.ts', 'src/langchain.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  dts: { resolve: ['@databazaar/types'], compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', paths: { '@databazaar/types': ['./src/marketplace-types.ts'] } } },
  external: ['ai', '@langchain/core', 'zod'],
})
