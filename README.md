# Varanus
Monitor utility for NodeJS apps

## What does it do?
A simple utility for monitoring function run times and flushing them out to another system in batches.

- Varanus is **agnostic with where the monitor logs are sent.** They can be sent to an SQL database, Elasticsearch, InfluxDB, Prometheus, or even just your regular log files.

- Varanus provides easy to use **wrapper functions** to be **as transparent as possible** in your code.

- Monitored functions have **low overhead**. In testing, monitoring functions adds about 0.0006ms overhead.

- Monitored functions can be given various log levels. Thus, you can log more information during testing **without adversely affecting production performance.** If the log level is turned off, expect only about 0.00008ms overhead per function call.

- **Failures to flush are handled gracefully.** If flushing throws an exception or returns a rejected promise, the records that would have been sent are re-collected and sent again on the next flush cycle.

- Varanus does not have to be initialized before anything is logged. Varanus will simply keep collecting records until you've successfully initialized it. **Your app can start logging metrics immediately on startup.**

## Example

##### Initialization
```js
// require('varanus') returns an initialization function that returns a new instance
var varanus = require('varanus')({
  flushInterval: 30000,
  logLevel: 'debug',
  flush: function(logs) {
    // Is a non-empty array of logs
    records.forEach(function(record) {
      console.log('Performance: ', {
        service: record.service, // Name of the monitor
        fnName: record.fnName, // Name of the function being monitored
        time: record.time, // Number of milliseconds it took to run that function
        level: record.level, // Log level for this record
        created: record.created, // Date when the function was first executed
        params: record.params // Any extra data passed to logTime() will be here. Will never be null/undefined
      });
    });
  }
});
```

##### Sample Service
```js
var monitor = varanus.newMonitor(__filename);
...

exports.getById = monitor.info(function getById(id) {
  return dao.getById(id); // Works when the function returns a promise
});

exports.getByName = monitor.debug(function getByName(name, callback) {
  // Also works with callback functions, if it's the last argument and follows (err, result) style
  return dao.getByName(name, callback);
});

exports.transform = monitor.trace(function transform(records) {
  // And of course works with synchronous functions
  for (var i = 0; i < records.length; i += 1) {
    ...
  });

  return ...
});

exports.foo = function() {
  // Alternatively, instead of wrapping a function, you can directly call
  //  monitor.logTime(logLevel, fnName, startMillis, endMillis)
  var start = Date.now();
  ...
  monitor.logTime('info', 'foo', start, Date.now());
}
```

## Log Levels
Just like other logging frameworks like Bunyan, Winston, etc, Varanus supports log levels. These are used primarily to control how much is logged in various environments. For instance, during testing, it's probably worthwhile monitoring just about everything. However, in production, it may be wiser to only monitor key functions, in order to cut down on overhead spent logging.

When a log level is set, monitors set below that level will be ignored. For instance, if Varnus is set to level `debug`, then all logs from functions monitored at the `trace` level will be thrown away. There will still be a slight overhead when calling `trace` functions, but it will be considerably less than if `trace` were enabled.

Unlike textual logging frameworks, there are no `warn`, `error`, or `fatal` log levels.

## Performance
In testing, monitoring synchronous/promise functions seems to add roughly 600ns overhead. That means you'd have to call that function over 1,500 times for the performance to degrade by just 1ms. If your function being monitored normally takes 1ms to run, then monitoring it adds an overhead of about 0.06%.

If the monitor is set below the log level threshold (IE: it's `trace` when the level is set to `info`), then the overhead drops to about 80ns. That means the function can be called about 12,500 times for the performance to be degraded by 1ms.

For a comparison, simply doing `console.log('foo')` takes more than 6,000ns per call.

**Note that traditional Node callback-style functions require some addition processing to intercept, and will roughly double that overhead.** It's still pretty trivial, however.

Testing is done right now by running the rather rudimentary `perfTest.js` file via `npm run perf`. It's far from perfect, but it allows for some tuning.

## API

### Varanus Initialization
The following functions are available on the initialization function:
- `flush` **Required** Function to call to flush a batch of records. This will usually format and send them to an external system, such as Elasticsearch, Mongo, etc. A non-empty array of records will be the only argument. See the example above to to see the available fields. May return a promise, which, if rejected, will result in the records being re-attempted in the next flush. (The ability to use a traditional Node callback function is in the works.)
- `flushInterval` **Optional** - **Integer** - Number of milliseconds between flushing records. Defaults to `60000` (One minute).
- `maxRecords` **Optional** - **Integer** - Maximum number of records to gather in memory before automatically flushing, regardless of `flushInterval`. **Optional** - **Integer** - Set to a number <= 1 to flush on every record. Defaults to `Infinity`.
- `level` **Optional** - **`'off'`|`'trace'`|`'debug'`|`'info'`** - The log level for Varanus. Defaults to `info`.
- `captureErrors` **Optional** - **Boolean** - Whether or not to capture errors that occur in monitored functions. If `true`, then if a monitored function threw/rejected, the error will be in `params.err` passed to the record in `flush()`. Defaults to `true`.
- `log` **Optional** - **Bunyan-like Logger** - Custom logger to use. Must support at least `warn()`, and `error()` functions, in the style of [Bunyan](https://github.com/trentm/node-bunyan) logs. Logging is a no-op by default.

### Varanus Instance Functions
- `newMonitor(string)` Creates and returns a new Monitor (see below) which can monitor the execution times of functions and log them. The only argument is the monitor name. It is recommended that you pass in `__filename` as the monitor name. Varanus will automatically strip the root path (`process.cwd()`) from the filename. Assuming the app is always launched from the same folder, this will yield consistent results across multiple deployments.
- `flush()` Will force a a call to the flush function defined during initialization. Note that if there are no records in memory, this will not do anything.
- `setLogLevel(string)` Sets the log level for Varnus. May be one of `off`|`trace`|`debug`|`info`.
- `logEnabled(string)` Returns `true` if the given log level is enabled. For instance, if the log level is `debug`, then `logEnabled('info')` will return `true`, while `logEnabled('trace')` will return `false`.

### Monitors
Monitors are created by calling `newMonitor(string)` on a Varanaus instance. They are used to wrap functions to be monitored, and can manually log times if necessary.

```js
var monitor = varanus.newMonitor(__filename);
```

##### Wrapping functions
The easiest way to use Varanus is to just wrap your functions and let Varanus do the work.

Monitors are functions that take in one or two arguments. A single **named** function can be passed as the only argument. If the function is anonymous, then you should provide a name for the function as the last argument.

```js
monitor.debug(function foo() { ... });
// OR
monitor.debug(function() { ... }, 'foo');
```

The wrapped functions can be:
- Promise-based, where the function returns a Promise
- Traditional Node callback-style, where the last argument is a function with the signature `function(err, result)`
- Synchronous, where it either returns a non-Promise value, or nothing at all

There are methods on `monitor` for each log level:

```js
monitor.trace(function foo() { ... });
monitor.debug(function foo() { ... });
monitor.info(function foo() { ... });
```

Lastly, there is a raw `logTime(string, string, int, int, obj)` function for cases where wrapping a function is not feasible. This is a low-level function and should generally be used only when absolutely necessary.

Note! When using `logTime`, Varanus has no knowledge of whether an error has occurred, so even if `captureErrors` was set to true during initialization, you'll have to manually include any error in the params object. (See the example below.)

- `logTime(logLevel, fnName, startMillis, endMillis, params)` Logs times directly.
  - `logLevel` **Required** - **String** - The log level. If the Varanus log level is set above the threshold, this record is essentially thrown away immediately. See above section on log levels for possible values.
  - `fnName` **Required** - **String** - The function name
  - `startMillis` **Required** - **Integer** - The Unix milliseconds value (usually from `Date.now()`) of when the function was started
  - `endMillis` **Required** - **Integer** - Unix milliseconds value of when the function completed
  - `params` **Optional** - **Object** - An extra parameters object to hold whatever data you may want to be included in the record when passed to `flush()`.

```js
function foo(cb) {
  var start = Date.now();
  database.find({id: 42}, function(err, result) {
    monitor.logTime('info', 'foo', start, Date.now(), {err: err});
    cb(err, result);
  });
}
```

## Previous Versions
### Upgrading from 2.x to 3.x
- Now requires at least **Node 4**
- Optimized for ES6 imports
ES6 Import style:
```js
import varanusInit from 'varanus';
const varanus = varanusInit(varanusOpts);
```
If using old-style `require()`, you'll need to use the `default` property:
```js
const varanusInit = require('varanus').default;
const varanus = varanusInit(varanusOpts);
```
- Manual function name is now the last argument

If monitoring anonymous functions, the name to use for the function is now the LAST argument, instead of the first:
```js
const fn = monitor.info((foo) => somethingAsync(foo), 'fooFunction');
```

- Monitored functions now have the same name as the functions they wrap:
```js
function foo(x) { return 'abc'; };
const fn = monitor.info(foo);
console.log(fn.name); // Now prints out 'foo' instead of 'undefined'

const fn2 = monitor.debug(x => 'abc', 'bar');
console.log(fn2.name); // Prints out 'bar', the name given to the monitor function
```