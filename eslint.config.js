// eslint.config.js
import builderbotPlugin from 'eslint-plugin-builderbot'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'
import neostandard from 'neostandard'

export default [
  ...neostandard({
    ignores: ['node_modules'],
    files: ['**/*.js', '**/*.jsx'],
  }),
  {
    plugins: {
      builderbot: builderbotPlugin,
      jsxA11y: jsxA11yPlugin,
    },
    rules: {
      '@stylistic/space-before-function-paren': 'off',
      'no-unsafe-optional-chaining': 'off',
      'import/no-duplicates': 'off',
    },
  },
]
