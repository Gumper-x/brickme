import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

export default defineConfig({
  input: './src/index.ts',
  output: {
    dir: 'dist',
    entryFileNames: '[name].mjs',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    dts({
      compilerOptions: {
        noEmit: false,
      },
      sourcemap: true,
      tsconfig: './tsconfig.json',
    }),
  ],
})
