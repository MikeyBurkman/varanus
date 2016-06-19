
'use strict';

var _configured = false;
var _level = 0; // Until initialized, log all calls TODO How to handle this better?
var _log = _defaultLogger();
var _flushInterval;
var _maxRecords;
var _flush;

// Will flush using this setTimeout
var _timeout;
// Contains everything that hasn't been flushed yet
var _items = [];

var levelMap = {
  trace: 10,
  debug: 20,
  info: 30
};

///// Public API
exports.init = init;
exports.newMonitor = newMonitor;
exports.flush = flush;
exports.setLogLevel = setLogLevel;
exports.disable = disable;
exports.logEnabled = logEnabled;
////////////////

function init(opts) {
  _configured = false;

  _level = levelMap[opts.level || 'info'];
  if (opts.enabled === false) {
    _level = Infinity; // Nothing is above this threshold, so nothing gets logged
  }
  _flush = opts.flush;
  _flushInterval = opts.flushInterval || 60000;
  _maxRecords = opts.maxRecords || Infinity;
  _log = opts.log || _defaultLogger();

  if (!_level) {
    throw new Error('Must provide a valid level attribute: ', Object.keys(levelMap).join(' | '));
  }

  if (!_flush) {
    throw new Error('You must provide a `flush` funtion to init(opts)');
  }

  _configured = true;

  _timeout = setTimeout(flush, _flushInterval);

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

  // If we flushed because we reached our max items, then make sure we don't
  //  try to automatically flush again until the flushInterval has passed
  clearTimeout(_timeout);
  _timeout = setTimeout(flush, _flushInterval);

  if (_items.length === 0) {
    return;
  }

  if (!_configured) {
    _log.warn('Varanus is trying to flush records, but it has not been initialized yet');
    return;
  }

  var curBatch = _items;
  _items = [];

  var res;

  try {
    res = _flush(curBatch);
  } catch (err) {
    // In case _flush is synchronous
    _log.error(err, 'Error sending items');
    // In case the error is transient, make sure we don't lose any logs
    _items = _items.concat(curBatch);
  }

  if (res && res.catch) {
    // Was probably a promise -- try catching and handling any errors
    res.catch(function(err) {
      _log.error(err, 'Error sending items');
      // In case the error is transient, make sure we don't lose any logs
      _items = _items.concat(curBatch);
    });
  }

  // TODO: What if flush() is a callback function?
}


function setLogLevel(level) {
  var lvl = levelMap[level || 'info'];
  if (!lvl) {
    throw new Error('Must provide a valid level attribute: ', Object.keys(levelMap).join(' | '));
  }
  _level = lvl;
}

function disable() {
  _level = Infinity;
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

  _items.push(item);

  if (_items.length >= _maxRecords) {
    flush();
  }
}

function _defaultLogger() {
  return {
    warn: console.error.bind(console, '<WARN>'),
    error: console.error.bind(console, '<ERROR>')
  };
}
