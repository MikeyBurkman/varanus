# Varanus
Monitor utility for NodeJS apps

### What does it do?
A simple utility for monitoring function run times and flushing them out to another system in batches.

Varanus is agnostic when it comes to where these logs go. It can be a SQL database, Elasticsearch, InfluxDB, Prometheus, or even just your regular log files.

Failures to flush are handled gracefully. If flushing throws an exception or returns a rejected promise, the records that would have been sent are re-collected and sent again on the next flush cycle. 

Varanus does not have to be initialized before anything is logged. Varanus will simply keep collecting records until you've successfully initialized it. Your app can start logging metrics immediately on startup.

### Example

Initialization
```js
var varanus = require('varanus');

varanus.init({
  flush: function(logs) {
    // Is an array of logs, with format {service: string, fnName: string, time: integer (ms), created: Date}
    console.log('Performance logs: ', logs);
  }
});
```

Sample Service
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
  // Alternatively, you can call monitor.logTime() directly instead of wrapping a function
  var start = Date.now();
  ...
  monitor.logTime('foo', Date.now() - start); // fnName will be set to 'foo'
}
```

### API
TODO (Look at `test.js` for now)

