const path = require('path');
const rules = require('./webpack.rules');
const webpack = require('webpack');

// Importante: dotenv debe resolver el .env del proyecto (no depender del cwd del proceso)
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

module.exports = {
  // Put your normal webpack config below here
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
  },
  plugins: [
    // Inyectar variables de entorno en el código del renderer
    new webpack.DefinePlugin({
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
      // Portal firma: base del API (ej. http://localhost:3001). El secreto se queda en el proceso main.
      'process.env.FIRMA_SMS_API_BASE': JSON.stringify(process.env.FIRMA_SMS_API_BASE || ''),
      // Constantes explícitas (más fiables que depender del reemplazo de `process.env.*` en todos los casos)
      __FIRMA_SMS_API_BASE__: JSON.stringify(process.env.FIRMA_SMS_API_BASE || ''),
    }),
  ],
};
