import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default [
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
            src: ['manifest.json', 'content.js', 'rules.json', 'popup.html'],
            dest: 'dist'
          },
          {
            src: ['platform/*'],
            dest: 'dist/platform'
          }
        ]
      })
    ]
  }
];
