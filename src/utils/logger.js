const log = {
  info: (...args) => {
    if (window.pos?.logInfo) window.pos.logInfo(args.join(' '));
    else console.log(...args);
  },

  warn: (...args) => {
    if (window.pos?.logWarn) window.pos.logWarn(args.join(' '));
    else console.warn(...args);
  },

  error: (...args) => {
    if (window.pos?.logError) window.pos.logError(args.join(' '));
    else console.error(...args);
  },

  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(...args);
    }
  },
};

export default log;
