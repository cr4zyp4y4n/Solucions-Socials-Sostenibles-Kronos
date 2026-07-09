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
      'process.env.HOLDED_V2_API_KEY_SOLUCIONS': JSON.stringify(process.env.HOLDED_V2_API_KEY_SOLUCIONS || ''),
      'process.env.HOLDED_V2_API_KEY_MENJAR_DHORT': JSON.stringify(process.env.HOLDED_V2_API_KEY_MENJAR_DHORT || ''),
      // Portal firma: base del API (ej. http://localhost:3001) y secreto para POST /api/firma/sms
      'process.env.FIRMA_SMS_API_BASE': JSON.stringify(process.env.FIRMA_SMS_API_BASE || ''),
      'process.env.FIRMA_SMS_API_SECRET': JSON.stringify(process.env.FIRMA_SMS_API_SECRET || ''),
      'process.env.OBRADOR_TRACE_BASE_URL': JSON.stringify(process.env.OBRADOR_TRACE_BASE_URL || ''),
      // Constantes explícitas (más fiables que depender del reemplazo de `process.env.*` en todos los casos)
      __FIRMA_SMS_API_BASE__: JSON.stringify(process.env.FIRMA_SMS_API_BASE || ''),
      __FIRMA_SMS_API_SECRET__: JSON.stringify(process.env.FIRMA_SMS_API_SECRET || ''),
    }),
  ],
};
