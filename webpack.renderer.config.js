const rules = require('./webpack.rules');
const webpack = require('webpack');
require('dotenv').config();

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
    }),
  ],
};
