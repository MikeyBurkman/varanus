
'use strict';

var _configured = false;
var _log;
var _flushInterval;
var _flush;

// Will flush using this interval
var _interval;
// Contains everything that hasn't been flushed yet
var _items = [];

///// Public API
exports.init = init;
exports.newMonitor = newMonitor;
exports.flush = flush;
exports.stop = stop;
exports.start = start;
////////////////

function init(opts) {
  _configured = false;

  _flush = opts.flush;
  _flushInterval = opts.flushInterval || 60000;
  _log = opts.log || _defaultLogger();

  if (!_flush) {
    throw new Error('You must provide a `flush` funtion to init(opts)');
  }

  _configured = true;

  start();

  return module.exports;
}

function newMonitor(opts) {
  if (typeof opts === 'string') {
    opts = {
      file: opts
    };
  }

  var serviceName;

  if (opts.file) {
    serviceName = _removeFilePrefix(opts.file);
  } else {
    serviceName = opts.name;
  }

  var fn = _monitor.bind(null, serviceName);
  fn.logTime = _logTime.bind(null, serviceName);

  return fn;
}

function flush() {
  if (_items.length === 0) {
    return;
  }

  if (!_configured) {
    _log.warn('Varanus is trying to flush records, but it has not been initialized yet');
    return;
  }

  _log.info('Flushing %s records', _items.length);

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
}

function start() {
  if (!_interval) {
    _interval = setInterval(flush, _flushInterval);
  }
}

function stop() {
  flush()
    .then(function() {
      clearInterval(_interval);
      _interval = undefined;
    });
}

////

function _removeFilePrefix(fileName) {
  return fileName.replace(process.cwd(), '');
}

function _monitor(serviceName, fnName, fn) {
  if (typeof fnName === 'function') {
    fn = fnName;
    fnName = fn.name;
  }

  function l(timeSpent) {
    _logTime(serviceName, fnName, timeSpent);
  }

  return function() {
    var args = Array.prototype.slice.call(arguments);

    var start = Date.now();

    if (typeof args[args.length - 1] === 'function') {
      // Async callback function
      var callback = args.pop();

      args.push(function() {
        l(Date.now() - start);
        callback.apply(undefined, arguments);
      });

      return fn.apply(undefined, args);

    } else {
      var res = fn.apply(undefined, args);
      if (res.then) {
        // Probably (hopefully) a promise
        return res.then(function(data) {
          l(Date.now() - start);
          return data;
        });

      } else {
        // Synchronous function
        l(Date.now() - start);
        return res;
      }

    }
  };
}

function _logTime(monitorName, fnName, timeSpent) {

  var item = {
    name: monitorName + '.' + fnName,
    time: timeSpent,
    created: new Date()
  };

  _items.push(item);
}

function _defaultLogger() {
  return {
    debug: console.log.bind(console, '<DEBUG>'),
    info: console.log.bind(console, '<INFO>'),
    warn: console.error.bind(console, '<WARN>'),
    error: console.error.bind(console, '<ERROR>')
  };
}
