
const x51 = require('x51');

interface LevelMap {
  [level: string]: number;
}

const LEVEL_MAP: LevelMap = {
  trace: 10,
  debug: 20,
  info: 30,
  off: Infinity
};

export type Level = 'trace' | 'debug' | 'info';

export interface Record {
  service: string;
  fnName: string;
  time: number;
  level: Level;
  created: Date;
  params: any;
}

export interface Options {
  level?: Level | 'off';
  flush: (records: Record[]) => void;
  flushInterval?: number;
  maxRecords?: number;
  log?: any;
  captureErrors?: boolean
}

export type MonitorFn = <T extends Function>(fn: T, fnName?: string) => T;

export interface Monitor {
  logTime: (logLevel: Level, fnName: string, startTime: number, endTime: number) => void;
  trace: MonitorFn
  debug: MonitorFn
  info: MonitorFn
}

export default function (opts: Options) {

  let _level: number;
  setLogLevel(opts.level || 'info');

  const _captureErrors = (opts.captureErrors === false) ? false : true;

  const _x51 = x51({
    flush: opts.flush,
    flushInterval: opts.flushInterval,
    maxRecords: opts.maxRecords,
    log: opts.log
  });

  // Public API
  const self = {
    newMonitor: newMonitor,
    flush: flush,
    setLogLevel: setLogLevel,
    logEnabled: logEnabled
  };

  return self;

  ////

  function newMonitor(monitorName: string): Monitor {

    const serviceName = _formatFileName(monitorName);

    const logTime = function (logLevel: Level, fnName: string, startTime: number, endTime: number) {
      if (!logEnabled(logLevel)) {
        return;
      }

      return _logTime(serviceName, logLevel, fnName, startTime, endTime);
    };

    return {
      trace: <T extends Function>(fn: T, fnName?: string): T => _monitor('trace', serviceName, fn, fnName),
      debug: <T extends Function>(fn: T, fnName?: string): T => _monitor('debug', serviceName, fn, fnName),
      info: <T extends Function>(fn: T, fnName?: string): T => _monitor('info', serviceName, fn, fnName),
      logTime: logTime
    }

  }

  function flush(): void {
    return _x51.flush();
  }

  function setLogLevel(level: Level | 'off'): void {
    const lvl = LEVEL_MAP[level];
    if (!lvl) {
      throw new Error('Must provide a valid level attribute: ' + Object.keys(LEVEL_MAP).join(' | '));
    }
    _level = lvl;
  }

  function logEnabled(logLevel: Level) {
    return (getLogLevelNumber(logLevel) >= _level);
  }

  // Private functions

  function getLogLevelNumber(logLevel: Level | 'off') {
    return LEVEL_MAP[logLevel] || Infinity;
  }

  function _formatFileName(fileName: string) {
    const withoutRoot = fileName.replace(process.cwd(), '');
    const fileExt = withoutRoot.lastIndexOf('.');
    return (fileExt > -1) ? withoutRoot.substr(0, fileExt) : withoutRoot;
  }

  function _monitor<T extends Function>(logLevel: Level, serviceName: string, fn: T, fnName?: string): T {

    const name = fnName || fn.name || '<anonymous>';

    const logLevelNumber = getLogLevelNumber(logLevel);

    function finish(start: number, err?: any) {
      let params: any;

      if (err && _captureErrors) {
        params = {
          err: err
        };
      }
      _logTime(serviceName, logLevel, name, start, Date.now(), params);
    }

    const wrapped = <T><any>function () {
      if (logLevelNumber < _level) {
        // Logging is off, just do a pass-through
        return fn.apply(undefined, arguments);
      }

      const start = Date.now();

      if (typeof arguments[arguments.length - 1] === 'function') {
        const args: any[] = Array.prototype.slice.call(arguments);

        // Async callback function
        const callback = args.pop();

        args.push(function (err: any) {
          finish(start, err);
          callback.apply(undefined, arguments);
        });

        return fn.apply(undefined, args);

      } else {
        let res: any;

        try {
          res = fn.apply(undefined, arguments);
        } catch (err) {
          finish(start, err);
          throw err;
        }

        if (res && res.then && res.catch) {
          // Probably (hopefully) a promise
          return res.then(function (data: any) {
            finish(start);
            return data;
          })
            .catch(function (err: any) {
              finish(start, err);
              throw err;
            });

        } else {
          // Synchronous function
          finish(start);
          return res;
        }

      }
    };

    // Attempt to set the name of the new function
    Object.defineProperty(wrapped, 'name', { 
      value: name,
      configurable: true 
    });

    return wrapped;
  }

  function _logTime(monitorName: string, logLevel: string, fnName: string, startTime: number, endTime: number, params?: any) {
    const item = {
      service: monitorName,
      fnName: fnName,
      time: endTime - startTime,
      level: logLevel,
      created: new Date(startTime),
      params: params || {}
    };

    _x51.push(item);
  }

};
