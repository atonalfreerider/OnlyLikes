import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import terser from '@rollup/plugin-terser';

export default [
  // Background script
  {
    input: 'background.js',
    output: {
      dir: 'dist',
      format: 'esm'
    },
    plugins: [
      nodeResolve({
        browser: true
      }),
      commonjs(),
      copy({
        targets: [
          {
            src: ['manifest.json', 'rules.json', 'popup.html'],
            dest: 'dist'
          },
          {
            src: ['platform/*'],
            dest: 'dist/platform'
          },
          {
            src: ['icons/*'],
            dest: 'dist/icons'
          }
        ]
      }),
      terser()
    ]
  },
  // Content script
  {
    input: 'content.js',
    output: {
      file: 'dist/content.js',
      format: 'iife', // Content scripts must be in IIFE format
      name: 'ContentScript'
    },
    plugins: [
      nodeResolve({
        browser: true
      }),
      commonjs(),
      terser()
    ]
  }
];
