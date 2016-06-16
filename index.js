
'use strict';

var _disabled = false;
var _configured = false;
var _log = _defaultLogger();
var _flushInterval;
var _maxRecords;
var _flush;

// Will flush using this setTimeout
var _timeout;
// Contains everything that hasn't been flushed yet
var _items = [];

///// Public API
exports.init = init;
exports.newMonitor = newMonitor;
exports.flush = flush;
exports.enable = enable;
exports.disable = disable;
////////////////

function init(opts) {
  _configured = false;

  _disabled = opts.enabled === false;
  _flush = opts.flush;
  _flushInterval = opts.flushInterval || 60000;
  _maxRecords = opts.maxRecords || Infinity;
  _log = opts.log || _defaultLogger();

  if (!_flush) {
    throw new Error('You must provide a `flush` funtion to init(opts)');
  }

  _configured = true;

  _timeout = setTimeout(flush, _flushInterval);

  return module.exports;
}

function newMonitor(monitorName) {

  var serviceName = _formatFileName(monitorName);

  var fn = _monitor.bind(null, serviceName);
  fn.logTime = _logTime.bind(null, serviceName);

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


function enable() {
  _disabled = false;
}

function disable() {
  _disabled = true;
}

////

function _formatFileName(fileName) {
  var withoutRoot = fileName.replace(process.cwd(), '');
  var fileExt = withoutRoot.lastIndexOf('.');
  return (fileExt > -1) ? withoutRoot.substr(0, fileExt) : withoutRoot;
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

function _logTime(monitorName, fnName, startTime, endTime) {

  if (_disabled) {
    return;
  }

  var item = {
    service: monitorName,
    fnName: fnName,
    time: endTime - startTime,
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
