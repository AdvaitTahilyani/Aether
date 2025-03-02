# Aether

A modern Electron application with properly separated main and renderer processes.

## Project Structure

- `electron/`: Contains all main process code
  - `main.ts`: Main process entry point
  - `preload.js`: Preload script for secure IPC communication
- `src/`: Contains all renderer process code (React application)
  - `main.tsx`: Renderer entry point
  - `App.tsx`: Main React component
- `dist/`: Built renderer process code (bundled by Vite)
- `dist-electron/`: Built main process code (compiled by TypeScript)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev:electron

# Build for production
npm run build:electron
```

## Architecture

This application follows Electron's recommended architecture with proper separation of concerns:

- **Main Process**: Handles Node.js and Electron APIs, native functionality, and system integration
- **Renderer Process**: Handles the UI using React, bundled by Vite
- **Preload Script**: Provides a secure bridge between the main and renderer processes

This separation ensures:

- Node-specific and native code remains only in the main process
- The renderer bundle is lighter, faster, and free from Node-only dependencies
- No errors from Vite trying to resolve native modules that aren't meant for the browser

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ["./tsconfig.node.json", "./tsconfig.app.json"],
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    "react-x": reactX,
    "react-dom": reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs["recommended-typescript"].rules,
    ...reactDom.configs.recommended.rules,
  },
});
```
