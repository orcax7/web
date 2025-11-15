# Technology Stack

## Frontend Framework
- **React 18.2.0** - Main UI framework
- **Vite 4.4.5** - Build tool and development server
- **JSX** - Component syntax (not TypeScript)

## Key Libraries
- **@monaco-editor/react** - Code editor component
- **react-router-dom** - Client-side routing
- **axios** - HTTP client for API calls
- **@headlessui/react** - Accessible UI components
- **react-icons** - Icon library
- **aos** - Animation library
- **swr** - Data fetching and caching

## Development Tools
- **ESLint** - Linting with React-specific plugins
- **PostCSS + Autoprefixer** - CSS processing
- **Vite React Plugin** - Hot module replacement

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint checks
```

### Project Structure
- ES Modules (`"type": "module"` in package.json)
- No TypeScript - pure JavaScript/JSX
- Vite-based build system with HMR support