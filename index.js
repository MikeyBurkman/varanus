
'use strict';

var x51 = require('x51');

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
    logEnabled: logEnabled
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

    return function() {
      if (!logEnabled(logLevel)) {
        return fn.apply(undefined, arguments);
      }

      var start = Date.now();
      function finish() {
        _logTime(serviceName, logLevel, fnName, start, Date.now());
      }

      if (typeof arguments[arguments.length - 1] === 'function') {
        var args = Array.prototype.slice.call(arguments);

        // Async callback function
        var callback = args.pop();

        args.push(function() {
          finish();
          callback.apply(undefined, arguments);
        });

        return fn.apply(undefined, args);

      } else {
        var res = fn.apply(undefined, arguments);
        if (res && res.then) {
          // Probably (hopefully) a promise
          return res.then(function(data) {
            finish();
            return data;
          });

        } else {
          // Synchronous function
          finish();
          return res;
        }

      }
    };
  }

  function _logTime(monitorName, logLevel, fnName, startTime, endTime) {

    var item = {
      service: monitorName,
      fnName: fnName,
      time: endTime - startTime,
      level: logLevel,
      created: new Date(startTime)
    };

    _x51.push(item);
  }
  
};
