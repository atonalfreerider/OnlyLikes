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
            src: ['manifest.json', 'popup.html', 'comprehensive-test.html'],
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
  },
  // Popup script
  {
    input: 'popup.js',
    output: {
      file: 'dist/popup.js',
      format: 'iife',
      name: 'PopupScript'
    },
    plugins: [
      nodeResolve({
        browser: true
      }),
      commonjs(),
      terser()
    ]
  },
  // Options diagnostic script
  {
    input: 'comprehensive-test.js',
    output: {
      file: 'dist/comprehensive-test.js',
      format: 'iife',
      name: 'ComprehensiveTestSuite'
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
