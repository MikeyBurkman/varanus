# Varanus
Monitor utility for NodeJS apps

### What does it do?
A simple utility for monitoring function run times and flushing them out to another system in batches.

### Example

Initialization
```js
var varanus = require('varanus');

varanus.init({
  flush: function(logs) {
    // Is an array of logs, with format {name: string, time: integer (ms), created: Date}
    console.log('Performance logs: ', logs);
  }
});
```

Sample Service
```js
var monitor = require('varanus').newMonitor(__filename);
...

exports.getById = monitor(function getById(id) {
  return dao.getById(id); //dao.getById() returns a promise
});

exports.getByName = monitor(function getByName(name, callback) {
  return dao.getByName(name, callback); // Also works with callback functions
});

exports.transform = monitor(function transform(records) {
  return records.map(function(record) { ... }); // Also works with synchronous functions
});
```

### API
TODO (Look at `test.js` for now)

