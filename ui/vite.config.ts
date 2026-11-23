import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import fs from 'fs';

function renameOutputPlugin(): Plugin {
  return {
    name: 'rename-output-to-app-html',
    enforce: 'post',
    generateBundle(_, bundle) {
      if (bundle['index.html']) {
        const file = bundle['index.html'];
        file.fileName = 'app.html';
        bundle['app.html'] = file;
        delete bundle['index.html'];
      }
    },
    closeBundle() {
      const distIndex = path.resolve(__dirname, '../dist/index.html');
      const distApp = path.resolve(__dirname, '../dist/app.html');
      if (fs.existsSync(distIndex) && !fs.existsSync(distApp)) {
        fs.copyFileSync(distIndex, distApp);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), renameOutputPlugin()],
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
