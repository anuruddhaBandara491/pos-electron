module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Disable all Node.js core module polyfills that electron-log tries to use
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        path: false,
        querystring: false,
        fs: false,
        os: false,
        net: false,
        tls: false,
        crypto: false,
        http: false,
        https: false,
        stream: false,
        util: false,
        buffer: false,
        assert: false,
        url: false,
        zlib: false,
      };
      
      // Prevent webpack from trying to bundle electron-log's node modules
      webpackConfig.externals = {
        ...(webpackConfig.externals || {}),
        'electron-log': 'electron-log',
      };
      
      return webpackConfig;
    },
  },
};
