
'use strict';

var x51 = require('x51');
var assert = require('assert');

var LEVEL_MAP = {
  trace: 10,
  debug: 20,
  info: 30,
  off: Infinity
};

module.exports = function(opts) {

  var _level;
  setLogLevel(opts.level);

  if (!_level) {
    throw new Error('Must provide a valid level attribute: ', Object.keys(LEVEL_MAP).join(' | '));
  }

  var _captureErrors = (opts.captureErrors === false) ? false : true;

  var _x51 = x51({
    flush: opts.flush,
    flushInterval: opts.flushInterval,
    maxRecords: opts.maxRecords,
    log: opts.log
  });

  // Public API
  var self = {
    newMonitor: newMonitor,
    flush: flush,
    setLogLevel: setLogLevel,
    logEnabled: logEnabled,
    getLogger: getLogger,
    levels: LEVEL_MAP
  };

  return self;

  ////

  function newMonitor(monitorName) {

    var serviceName = _formatFileName(monitorName);

    // Everything placed on fn is public API
    var fn = _monitor.bind(null, 'info', serviceName);
    fn.trace = _monitor.bind(null, 'trace', serviceName);
    fn.debug = _monitor.bind(null, 'debug', serviceName);
    fn.info = _monitor.bind(null, 'info', serviceName);

    fn.logTime = function(logLevel, fnName, startTime, endTime) {
      if (!logEnabled(logLevel)) {
        return;
      }

      return _logTime(serviceName, logLevel, fnName, startTime, endTime);
    };

    return fn;
  }

  function flush() {
    return _x51.flush();
  }

  function setLogLevel(level) {
    var lvl = LEVEL_MAP[level || 'info'];
    if (!lvl) {
      throw new Error('Must provide a valid level attribute: ', Object.keys(LEVEL_MAP).join(' | '));
    }
    _level = lvl;
  }

  function logEnabled(logLevel) {
    var lvl = LEVEL_MAP[logLevel] || Infinity;
    return (lvl >= _level);
  }

  // Private functions

  function _formatFileName(fileName) {
    var withoutRoot = fileName.replace(process.cwd(), '');
    var fileExt = withoutRoot.lastIndexOf('.');
    return (fileExt > -1) ? withoutRoot.substr(0, fileExt) : withoutRoot;
  }

  function _monitor(logLevel, serviceName, fnName, fn) {
    if (typeof fnName === 'function') {
      fn = fnName;
      fnName = fn.name;
    }

    function finish(start, err) {
      var params;

      if (err && _captureErrors) {
        params = {
          err: err
        };
      }
      _logTime(serviceName, logLevel, fnName, start, Date.now(), params);
    }

    return function() {
      if (!logEnabled(logLevel)) {
        return fn.apply(undefined, arguments);
      }

      var start = Date.now();

      if (typeof arguments[arguments.length - 1] === 'function') {
        var args = Array.prototype.slice.call(arguments);

        // Async callback function
        var callback = args.pop();

        args.push(function(err) {
          finish(start, err);
          callback.apply(undefined, arguments);
        });

        return fn.apply(undefined, args);

      } else {
        var res;

        try {
          res = fn.apply(undefined, arguments);
        } catch (err) {
          finish(start, err);
          throw err;
        }

        if (res && res.then && res.catch) {
          // Probably (hopefully) a promise
          return res.then(function(data) {
            finish(start);
            return data;
          })
          .catch(function(err) {
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
  }

  /**
   * Returns a logger that can be used programmatically.
   * @param  {String}   name
   * @param  {Number}   defaultLevel
   * @return {Function}
   */
  function getLogger (name, defaultLevel) {
    assert.equal(typeof name, 'string', 'getLogger expects a logger name');
    assert.notEqual(name.length, 0, 'getLogger expects a logger name');

    defaultLevel = defaultLevel || _level;

    function _log (fnName, start, end, lvl) {
      lvl = lvl || defaultLevel;
      end = end || Date.now();

      _logTime(name, lvl, fnName, start, end);
    }

    // Add methods for each log level, (info, trace, debug)
    Object.keys(LEVEL_MAP).forEach(function (key) {
      _log[key] = function (fnName, start, end) {
        _log(fnName, start, end, LEVEL_MAP[key]);
      };
    });

    return _log;
  }

  function _logTime(monitorName, logLevel, fnName, startTime, endTime, params) {

    var item = {
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
