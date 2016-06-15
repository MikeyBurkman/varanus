
'use strict';

var _configured = false;
var _log = _defaultLogger();
var _flushInterval;
var _maxItems;
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
  _maxItems = opts.maxItems || Infinity;
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
    serviceName = _formatFileName(opts.file);
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

  // TODO: What if flush() is a callback function?
}

function start() {
  if (!_interval) {
    _interval = setInterval(flush, _flushInterval);
  }
}

function stop() {
  flush();
  if (_interval) {
    clearInterval(_interval);
    _interval = undefined;
  }
}

////

function _formatFileName(fileName) {
  return fileName.substr(0, fileName.lastIndexOf('.')) // Remove file ext
    .replace(process.cwd(), ''); // Remove root directory
}

function _monitor(serviceName, fnName, fn) {
  if (typeof fnName === 'function') {
    fn = fnName;
    fnName = fn.name;
  }

  return function() {
    var args = Array.prototype.slice.call(arguments);

    var start = Date.now();
    function finish() {
      _logTime(serviceName, fnName, start, Date.now());
    }

    if (typeof args[args.length - 1] === 'function') {
      // Async callback function
      var callback = args.pop();

      args.push(function() {
        finish();
        callback.apply(undefined, arguments);
      });

      return fn.apply(undefined, args);

    } else {
      var res = fn.apply(undefined, args);
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

function _logTime(monitorName, fnName, startTime, endTime, wasError) {

  var item = {
    service: monitorName,
    fnName: fnName,
    time: endTime - startTime,
    created: new Date(startTime),
    wasError: wasError
  };

  _items.push(item);

  if (_items.length >= _maxItems) {
    flush();
  }
}

function _defaultLogger() {
  return {
    debug: console.log.bind(console, '<DEBUG>'),
    info: console.log.bind(console, '<INFO>'),
    warn: console.error.bind(console, '<WARN>'),
    error: console.error.bind(console, '<ERROR>')
  };
}
