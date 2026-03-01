import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { copyFileSync, cpSync, mkdirSync, existsSync } from 'fs';

function copyManifestAndAssets(): Plugin {
  return {
    name: 'copy-manifest-and-assets',
    closeBundle() {
      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'src/manifest.json'),
        resolve(__dirname, 'dist/manifest.json'),
      );

      // Copy icons
      const iconsDir = resolve(__dirname, 'dist/assets/icons');
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true });
      }
      cpSync(
        resolve(__dirname, 'src/assets/icons'),
        iconsDir,
        { recursive: true },
      );
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@providers': resolve(__dirname, 'src/providers'),
      '@automation': resolve(__dirname, 'src/automation'),
      '@chat': resolve(__dirname, 'src/chat'),
      '@mcp': resolve(__dirname, 'src/mcp'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        sidebar: resolve(__dirname, 'src/chat/sidebar.html'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
        'content-script': resolve(__dirname, 'src/automation/content-scripts/bridge.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content-script') {
            return 'content-scripts/[name].js';
          }
          if (chunkInfo.name === 'service-worker') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  plugins: [copyManifestAndAssets()],
});
