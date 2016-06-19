'use strict';

var varanus = require('./index.js');

varanus.init({
  flush: function() {},
  //maxRecords: 3000,
  level: 'info'
});

var monitor = varanus.newMonitor(__filename);

function fn() {}

var fnInfo = monitor.info(fn);
var fnDebug = monitor.debug(fn);
var fnTrace = monitor.trace(fn);
var fnLogTimeInfo = function() {
  var time = Date.now();
  monitor.logTime('fooService', 'info', 'fooFn', time, time + 50);
};
var fnLogTimeTrace = function() {
  return monitor.logTime('fooService', 'debug', 'fooFn', 0, 42);
};

var rawTime = time(fn);
console.log('Monitor Info Overhead/Call: ', time(fnInfo) - rawTime, 'ns');
console.log('Monitor Debug Overhead/Call: ', time(fnDebug) - rawTime, 'ns');
console.log('Monitor trace Overhead/Call: ', time(fnTrace) - rawTime, 'ns');
console.log('LogTime Info Time/Call: ', time(fnLogTimeInfo), 'ns');
console.log('LogTime Debug Time/Call: ', time(fnLogTimeTrace), 'ns');
process.exit(0);

function time(f) {
  var iterations = 1000000;
  var start = process.hrtime();
  for (var i = 0; i < iterations; i += 1) {
    f();
  }
  var res = Math.ceil(toNanos(process.hrtime(start))/iterations);
  varanus.flush();
  return res;
}

function toNanos(time) {
  return time[0] * 1e9 + time[1];
}
