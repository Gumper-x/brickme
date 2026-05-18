import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

export default defineConfig({
  input: './src/index.ts',
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: '[name].mjs',
    sourcemap: true,
  },
  plugins: [
    dts({
      sourcemap: true,
      tsconfig: './tsconfig.json',
      compilerOptions: {
        noEmit: false,
      },
    }),
  ],
})
