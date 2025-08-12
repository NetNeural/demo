import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      inlineSources: true
    })
  ],
  external: [
    '@supabase/supabase-js',
    '@supabase/auth-helpers-shared'
  ]
});
