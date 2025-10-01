const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    sidepanel: './src/sidepanel.ts',
    content: './src/content.ts',
    background: './src/background.ts',
    offscreen: './src/offscreen.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: '',
    clean: true
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        default: false,
        vendors: false,
        // Bundle everything into the main chunks
        content: {
          name: 'content',
          chunks: (chunk) => chunk.name === 'content',
          enforce: true
        }
      }
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'sidepanel.html', to: 'sidepanel.html' },
        { from: 'sidepanel.css', to: 'sidepanel.css' },
        { from: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs', to: 'pdf.worker.min.js' },
        { from: 'offscreen.html', to: 'offscreen.html' }
      ]
    })
  ],
  resolve: {
    extensions: ['.ts', '.js']
  }
};