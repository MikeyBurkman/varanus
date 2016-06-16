# Varanus
Monitor utility for NodeJS apps

## What does it do?
A simple utility for monitoring function run times and flushing them out to another system in batches.

Varanus is **agnostic with where the monitor logs are sent.** They can be sent to an SQL database, Elasticsearch, InfluxDB, Prometheus, or even just your regular log files.

Varanus provides easy to use **wrapper functions** to be **as transparent as possible** in your code.

**Failures to flush are handled gracefully.** If flushing throws an exception or returns a rejected promise, the records that would have been sent are re-collected and sent again on the next flush cycle.

Varanus does not have to be initialized before anything is logged. Varanus will simply keep collecting records until you've successfully initialized it. **Your app can start logging metrics immediately on startup.**

## Example

##### Initialization
```js
var varanus = require('varanus');

varanus.init({
  flushInterval: 30000,
  flush: function(logs) {
    // Is an array of logs, with format {service: string, fnName: string, time: integer (ms), created: Date}
    records.forEach(function(record) {
      console.log('Performance: ', {
        service: record.service, // Name of the monitor
        fnName: record.fnName, // Name of the function being monitored
        time: record.time, // Number of milliseconds it took to run that function
        created: record.created // Date when the function was first executed
      });
    });
  }
});
```

##### Sample Service
```js
var monitor = require('varanus').newMonitor(__filename);
...

exports.getById = monitor(function getById(id) {
  return dao.getById(id); // Works when the function returns a promise
});

exports.getByName = monitor(function getByName(name, callback) {
  // Also works with callback functions, if it's the last argument and follows (err, result) style
  return dao.getByName(name, callback);
});

exports.transform = monitor(function transform(records) {
  // And of course works with synchronous functions
  for (var i = 0; i < records.length; i += 1) {
    ...
  });
});

exports.foo = function() {
  // Alternatively, you can call monitor.logTime(fnName, start millis, end millis) directly instead of wrapping a function
  var start = Date.now();
  ...
  monitor.logTime('foo', start, Date.now());
}
```

## API

### Varanus
The following functions are available on the root Varanus object:

- `init(opts)` Will initialize Varanus. Possible options include:
  - `flush` **Required** Function to call to flush a batch of records. This will usually format and send them to an external system, such as Elasticsearch, Mongo, etc. A non-empty array of records will be the only argument. See the example above to to see the available fields. May return a promise, which, if rejected, will result in the records being re-attempted in the next flush. (The ability to use a traditional Node callback function is in the works.)
  - `enabled` **Optional** Boolean value to enable/disable logging completely. Can be re-enabled by calling `enable()` (below). Defaults to `true`.
  - `flushInterval` **Optional** Number of milliseconds between flushing records. Defaults to `60000` (One minute).
  - `maxRecords` **Optional** Maximum number of records to gather in memory before automatically flushing, regardless of `flushInterval`. Set to a number <= 1 to flush on every record. Defaults to `Infinity`.
  - `log` Customer logger to use. Must support at least `warn()`, and `error()` functions, in the style of [Bunyan](https://github.com/trentm/node-bunyan) logs. Defaults to `console.error`


- `newMonitor(string)` Creates a new Monitor (see below) which can monitor the execution times of functions and log them. The only argument is the monitor name. It is recommended that you pass in `__filename` as the monitor name. Varanus will automatically strip the root path (`process.cwd()`) from the filename. Assuming the app is always launched from the same folder, this will yield consistent results across multiple deployments.

- `flush()` Will force a a call to the flush function defined during initialization. Note that if there are no records in memory, this will not do anything.

- `disable()` Will disable all logging of records until `enable()` is called.

- `enable()` Will re-enable all logging of records, if it has been previously disabled.

### Monitor
Monitors are created by calling `newMonitor(string)` on the root Varanus object.

```js
var monitor = require('varanus').newMonitor(__filename);
```

Monitors are functions that take in one or two arguments:

- `monitor(function)` Wraps the given function and returns a new function that takes in the same arguments and returns the same values.
  - The function must have a name. This function name will be logged as the `fnName` when the function is executed.
  - The function may return a promise, use traditional Node callback style (where the last argument is a function that takes `(err, result)` as arguments, or it may return a regular value. In the last case, the function is assumed to be synchronous.

```js
exports.foo = monitor(function foo(cb) {
  database.find('foo=42', cb);
});
```

- `monitor(string, function)` Wraps the given function and returns a new function that takes in the same arguments and returns the same values.
  - This is identical to the single-argument function above, except the function name will always be the first argument, and the actual name of the function is ignored.

```js
exports.foo = monitor('foo', function (cb) {
  database.find('foo=42', cb);
});
```

- `logTime(string, int, int)` Logs times directly. Not usually used directly.
  - `string` The function name
  - `int` The Unix milliseconds value (usually from `Date.now()`) of when the function was started
  - `int` Unix milliseconds value of when the function completed

One caveat with wrapping a function is that the returned function will not have the correct (or any) function name. This `logTime(string, int, int)` can be used in that case.

```js
function foo(cb) {
  var start = Date.now();
  database.find('foo=42', function(err, result) {
    monitor.logTime('foo', start, Date.now());
    cb(err, result);
  });
}
```
