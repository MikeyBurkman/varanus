'use strict';

import varanusInit from './index';

const varanus = varanusInit({
  flush: function() {},
  maxRecords: 4000,
  level: 'info'
});

const monitor = varanus.newMonitor(__filename);

function fn() {}

const fnInfo = monitor.info(fn);
const fnDebug = monitor.debug(fn);
const fnTrace = monitor.trace(fn);
const fnLogTimeInfo = function() {
  const time = Date.now();
  monitor.logTime('info', 'fooFn', time, time + 50);
};
const fnLogTimeTrace = function() {
  return monitor.logTime('debug', 'fooFn', 0, 42);
};

const rawTime = time(fn);
console.log('Monitor Info Overhead/Call: ', time(fnInfo) - rawTime, 'ns');
console.log('Monitor Debug Overhead/Call: ', time(fnDebug) - rawTime, 'ns');
console.log('Monitor trace Overhead/Call: ', time(fnTrace) - rawTime, 'ns');
console.log('LogTime Info Time/Call: ', time(fnLogTimeInfo), 'ns');
console.log('LogTime Debug Time/Call: ', time(fnLogTimeTrace), 'ns');
process.exit(0);

function time(f: Function) {
  const iterations = 1000000;
  const start = process.hrtime();
  for (let i = 0; i < iterations; i += 1) {
    f();
  }
  const res = Math.ceil(toNanos(process.hrtime(start))/iterations);
  varanus.flush();
  return res;
}

function toNanos(time: number[]) {
  return time[0] * 1e9 + time[1];
}
