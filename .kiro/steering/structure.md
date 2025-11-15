# Project Structure & Organization

## Root Level
```
├── src/                    # Source code
├── public/                 # Static assets (icons, etc.)
├── .kiro/                  # Kiro AI assistant configuration
├── node_modules/           # Dependencies
├── package.json            # Project configuration
├── vite.config.js          # Vite build configuration
├── .eslintrc.cjs           # ESLint configuration
└── index.html              # Entry HTML file
```

## Source Structure
```
src/
├── main.jsx                # Application entry point
├── App.jsx                 # Root component (renders FileUpload)
├── App.css                 # Global styles
├── index.css               # Base styles
├── components/             # React components
│   ├── fileUpload.jsx      # Main UI component with editor
│   ├── fileUpload.css      # Component styles
│   ├── globalFunction.jsx  # Shared utilities
│   └── codeFixer/          # ESLint rule fixers
├── assets/                 # Static assets
├── Context/                # React context providers
├── router/                 # Routing configuration
├── Style/                  # Additional stylesheets
└── Utilities/              # Helper functions
```

## Code Fixer Architecture
```
src/components/codeFixer/
├── shared/                 # Common utilities
│   ├── fixerBase.js        # Base class for fixers
│   ├── contextAnalyzer.js  # Code context analysis
│   ├── codeValidator.js    # Fix validation
│   └── batchFixProcessor.js # Batch processing
├── registry/               # Fixer registration
│   └── fixerRegistry.js    # Central fixer registry
└── [rule-name].jsx/.js     # Individual rule fixers
```

## Naming Conventions
- **Components**: PascalCase for React components (`.jsx` extension)
- **Utilities**: camelCase for JavaScript modules (`.js` extension)
- **Fixers**: Match ESLint rule names (e.g., `noExtraSemi.jsx` for `no-extra-semi`)
- **Files**: Use kebab-case for multi-word file names when appropriate

## Architecture Patterns
- **Single Responsibility**: Each fixer handles one ESLint rule
- **Shared Utilities**: Common logic in `shared/` directory
- **Registry Pattern**: Central registration of all fixers
- **Context-Aware**: Fixers analyze code context before applying changes