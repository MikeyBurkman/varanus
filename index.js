
'use strict';

var x51 = require('x51')();

var _level = 0; // NOTE: Until initialized, we log all calls

var levelMap = {
  trace: 10,
  debug: 20,
  info: 30,
  off: Infinity
};

///// Public API
exports.init = init;
exports.newMonitor = newMonitor;
exports.flush = flush;
exports.setLogLevel = setLogLevel;
exports.logEnabled = logEnabled;
////////////////

function init(opts) {

  _level = levelMap[opts.level || 'info'];

  if (!_level) {
    throw new Error('Must provide a valid level attribute: ', Object.keys(levelMap).join(' | '));
  }

  x51.init({
    flush: opts.flush,
    flushInterval: opts.flushInterval,
    maxRecords: opts.maxRecords,
    log: opts.log
  });

  return module.exports;
}

function newMonitor(monitorName) {

  var serviceName = _formatFileName(monitorName);

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
  return x51.flush();
}

function setLogLevel(level) {
  var lvl = levelMap[level || 'info'];
  if (!lvl) {
    throw new Error('Must provide a valid level attribute: ', Object.keys(levelMap).join(' | '));
  }
  _level = lvl;
}

function logEnabled(logLevel) {
  var lvl = levelMap[logLevel] || Infinity;
  return (lvl >= _level);
}

////

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

  x51.push(item);
}
