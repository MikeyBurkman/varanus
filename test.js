'use strict';

var expect = require('chai').expect;
var sinon = require('sinon');
var Promise = require('bluebird');

describe(__filename, function() {

  var mod;

  beforeEach(function() {
    delete require.cache[require.resolve('./index')];
    mod = require('./index');
  });

  it('Should use the given service name in the flushed records', function() {
    var flush = sinon.stub();

    var varanus = mod({
      flush: flush
    });

    varanus.newMonitor('fooService').logTime('info', 'testFn', 0, 42);

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    var items = flush.getCall(0).args[0];
    expect(items.length).to.eql(1);
    expect(items[0].service).to.eql('fooService');
    expect(items[0].fnName).to.eql('testFn');
    expect(items[0].time).to.eql(42);
    expect(items[0].level).to.eql('info');
    expect(items[0].created).to.eql(new Date(0));
  });

  it('Should parse a filename if it is the arg to newMonitor()', function() {
    var flush = sinon.stub();

    var varanus = mod({
      flush: flush
    });

    varanus.newMonitor(__filename).logTime('info', 'testFn', 100, 142);

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    var items = flush.getCall(0).args[0];
    expect(items.length).to.eql(1);
    expect(items[0].service).to.eql('/test');
    expect(items[0].fnName).to.eql('testFn');
    expect(items[0].time).to.eql(42); // Difference between 142 and 42
    expect(items[0].level).to.eql('info');
    expect(items[0].created).to.eql(new Date(100));
  });

  it('Should be able to monitor callback functions', function(done) {
    var flush = sinon.stub();

    var varanus = mod({
      flush: flush
    });

    var monitor = varanus.newMonitor(__filename);

    var fn = monitor(function fooCallback(x, callback) {
      setTimeout(function() {
        callback(null, x);
      }, 200);
    });

    fn('blah', function(err, result) {
      expect(err).to.not.exist;
      expect(result).to.eql('blah');

      varanus.flush();

      expect(flush.callCount).to.eql(1);

      var items = flush.getCall(0).args[0];
      expect(items.length).to.eql(1);
      expect(items[0].service).to.eql('/test');
      expect(items[0].fnName).to.eql('fooCallback');
      expect(items[0].time).to.be.within(190, 210);
      expect(items[0].level).to.eql('info');
      expect(items[0]).to.have.property('created');

      done();
    });

  });

  it('Should be able to monitor promise functions', function() {
    var flush = sinon.stub();

    var varanus = mod({
      flush: flush
    });

    var monitor = varanus.newMonitor(__filename);

    var fn = monitor(function fooPromise() {
      return Promise.delay(200).return('blah');
    });

    return fn().then(function(result) {
      expect(result).to.eql('blah');

      varanus.flush();

      expect(flush.callCount).to.eql(1);

      var items = flush.getCall(0).args[0];
      expect(items.length).to.eql(1);
      expect(items[0].service).to.eql('/test');
      expect(items[0].fnName).to.eql('fooPromise');
      expect(items[0].time).to.be.within(190, 210);
      expect(items[0].level).to.eql('info');
      expect(items[0]).to.have.property('created');

    });
  });

  it('Should return the result of the function even when logging is disabled', function() {
    var flush = sinon.stub();

    var varanus = mod({
      flush: flush,
      level: 'off'
    });

    var monitor = varanus.newMonitor(__filename);

    var fn = monitor(function fooSync() {
      return 'blah';
    });

    var result = fn();

    expect(result).to.eql('blah');

    varanus.flush();

    expect(flush.callCount).to.eql(0);
  });

  it('Should be able to monitor functions that do not return values', function() {
    var flush = sinon.stub();

    var varanus = mod({
      flush: flush
    });

    var monitor = varanus.newMonitor(__filename);

    var fn = monitor(function fooNoReturn() {
      // noop
    });

    fn();

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    var items = flush.getCall(0).args[0];
    expect(items.length).to.eql(1);
    expect(items[0].service).to.eql('/test');
    expect(items[0].fnName).to.eql('fooNoReturn');
    expect(items[0]).to.have.property('created');
  });

  it('Should flush according to the flush interval', function(done) {
    var flush = sinon.stub();

    var varanus = mod({
      flush: flush,
      flushInterval: 200
    });

    varanus.newMonitor(__filename).logTime('info', 'testService', 0, 42);
    varanus.newMonitor(__filename).logTime('info', 'testService2', 50, 150);

    setTimeout(function() {
      expect(flush.callCount).to.eql(1);
      var items = flush.getCall(0).args[0];
      expect(items.length).to.eql(2);

      done();
    }, 250);

  });

  it('Should not lose records if flush throws an error', function() {
    var flush = sinon.stub();

    flush.onCall(0).throws(new Error());
    flush.onCall(1).returns(undefined);

    var varanus = mod({
      flush: flush
    });

    var monitor = varanus.newMonitor(__filename);

    monitor.logTime('info', 'testService', 0, 42);

    // This one will throw an error
    varanus.flush();

    expect(flush.callCount).to.eql(1);
    var items1 = flush.getCall(0).args[0];
    expect(items1.length).to.eql(1);

    // Send another record
    monitor.logTime('info', 'testService', 0, 50);

    // This one should succeed
    varanus.flush();

    expect(flush.callCount).to.eql(2);
    var items2 = flush.getCall(1).args[0];
    expect(items2.length).to.eql(2); // Should have both records this time
  });

  it('Should not lose records if flush returns a rejected promise', function(done) {
    var flush = sinon.stub();

    flush.onCall(0).returns(Promise.reject(new Error()));
    flush.onCall(1).returns(Promise.resolve());

    var varanus = mod({
      flush: flush
    });

    var monitor = varanus.newMonitor(__filename);

    monitor.logTime('info', 'testService', 0, 42);

    // This one will throw an error
    varanus.flush();

    expect(flush.callCount).to.eql(1);
    var items1 = flush.getCall(0).args[0];
    expect(items1.length).to.eql(1);

    // Send another record
    monitor.logTime('info', 'testService', 0, 50);

    setTimeout(function() {
      // This one should succeed
      varanus.flush();

      expect(flush.callCount).to.eql(2);
      var items2 = flush.getCall(1).args[0];
      expect(items2.length).to.eql(2); // Should have both records this time

      done();
    });
  });

  it('Should not flush automatically if the number of records is below the set threshold', function() {
    var flush = sinon.stub();

    var varanus = mod({
      flush: flush,
      maxRecords: 2
    });

    var monitor = varanus.newMonitor(__filename);

    monitor.logTime('info', 'testService1', 0, 42);

    expect(flush.callCount).to.eql(0);
  });

  it('Should proactively flush if the number of records passes the set threshold', function() {
    var flush = sinon.stub();

    var varanus = mod({
      flush: flush,
      maxRecords: 2
    });

    var monitor = varanus.newMonitor(__filename);

    monitor.logTime('info', 'testService1', 0, 42);
    monitor.logTime('info', 'testService2', 0, 50);

    expect(flush.callCount).to.eql(1);
    var items = flush.getCall(0).args[0];
    expect(items.length).to.eql(2);
  });

  describe('#Log Levels', function() {
    it('Should not log if log level is "off"', function() {
      var flush = sinon.stub();

      var varanus = mod({
        flush: flush,
        level: 'off'
      });

      varanus.newMonitor('fooService').logTime('info', 'testFn', 0, 42);

      varanus.flush();

      expect(flush.callCount).to.eql(0);
    });

    it('Should support chaning the log level dynamically', function() {
      var flush = sinon.stub();

      var varanus = mod({
        flush: flush,
        level: 'off'
      });

      var monitor = varanus.newMonitor('fooService');

      monitor.logTime('info', 'testFn', 0, 42);
      varanus.flush();
      expect(flush.callCount).to.eql(0);

      // Now set to something other than 'off' and try again
      varanus.setLogLevel('info');
      monitor.logTime('info', 'testFn', 0, 42);
      varanus.flush();
      expect(flush.callCount).to.eql(1);

      // Now set to 'off', try again, and make sure flush wasn't called again
      varanus.setLogLevel('off');
      monitor.logTime('info', 'testFn', 0, 42);
      varanus.flush();
      expect(flush.callCount).to.eql(1); // Still 1

    });
    
    it('Should not include logs below the set threshold, logTime()', function() {
      var flush = sinon.stub();

      var varanus = mod({
        flush: flush,
        level: 'debug'
      });

      var monitor = varanus.newMonitor(__filename);

      monitor.logTime('trace', 'testService1', 0, 42); // Shouldn't be logged
      monitor.logTime('debug', 'testService2', 0, 43);
      monitor.logTime('info', 'testService3', 0, 44);

      varanus.flush();

      expect(flush.callCount).to.eql(1);
      var items = flush.getCall(0).args[0];
      expect(items.length).to.eql(2); // Leave out trace
    });

    it('Should not include logs below the set threshold, using monitor()', function() {
      var flush = sinon.stub();

      var varanus = mod({
        flush: flush,
        level: 'debug'
      });

      var monitor = varanus.newMonitor(__filename);

      var fn1 = monitor.trace(function fn1() {});
      var fn2 = monitor.debug(function fn2() {});
      var fn3 = monitor.info(function fn3() {});

      fn1(); // Shouldn't be logged
      fn2();
      fn3();

      varanus.flush();

      expect(flush.callCount).to.eql(1);
      var items = flush.getCall(0).args[0];
      expect(items.length).to.eql(2); // Leave out trace
    });

    it('Should log default monitoring at INFO level', function() {
      var flush = sinon.stub();

      var varanus = mod({
        flush: flush,
        level: 'info'
      });

      var monitor = varanus.newMonitor(__filename);

      var fn1 = monitor(function fn1() {});

      fn1();

      varanus.flush();

      expect(flush.callCount).to.eql(1);
      var items = flush.getCall(0).args[0];
      expect(items.length).to.eql(1);
    });
  });

});
