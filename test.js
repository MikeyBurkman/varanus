'use strict';

var expect = require('chai').expect;
var sinon = require('sinon');
var Promise = require('bluebird');

describe(__filename, function() {

  var varanus;

  beforeEach(function() {
    if (varanus) {
      varanus.stop();
    }
    delete require.cache[require.resolve('./index')];
    varanus = require('./index');
  });

  it('Should use the given service name in the flushed records', function() {
    var flush = sinon.stub();

    varanus.init({
      flush: flush
    });

    varanus.newMonitor({
      name: 'fooService'
    }).logTime('testFn', 42);

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    var items = flush.getCall(0).args[0];
    expect(items.length).to.eql(1);
    expect(items[0].service).to.eql('fooService');
    expect(items[0].fnName).to.eql('testFn');
    expect(items[0].time).to.eql(42);
    expect(items[0]).to.have.property('created');
  });

  it('Should parse the filename if it is the only arg to newMonitor()', function() {
    var flush = sinon.stub();

    varanus.init({
      flush: flush
    });

    varanus.newMonitor(__filename).logTime('testFn', 42);

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    var items = flush.getCall(0).args[0];
    expect(items.length).to.eql(1);
    expect(items[0].service).to.eql('/test');
    expect(items[0].fnName).to.eql('testFn');
    expect(items[0].time).to.eql(42);
    expect(items[0]).to.have.property('created');

  });

  it('Should be able to monitor callback functions', function(done) {
    var flush = sinon.stub();

    varanus.init({
      flush: flush
    });

    var monitor = varanus.newMonitor(__filename);

    var fn = monitor(function fooCallback(callback) {
      setTimeout(function() {
        callback(null, 'blah');
      }, 200);
    });

    fn(function(err, result) {
      expect(err).to.not.exist;
      expect(result).to.eql('blah');

      varanus.flush();

      expect(flush.callCount).to.eql(1);

      var items = flush.getCall(0).args[0];
      expect(items.length).to.eql(1);
      expect(items[0].service).to.eql('/test');
      expect(items[0].fnName).to.eql('fooCallback');
      expect(items[0].time).to.be.within(200, 250);
      expect(items[0]).to.have.property('created');

      done();
    });

  });

  it('Should be able to monitor promise functions', function() {
    var flush = sinon.stub();

    varanus.init({
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
      expect(items[0].time).to.be.within(200, 250);
      expect(items[0]).to.have.property('created');

    });
  });

  it('Should be able to monitor functions that do not return values', function() {
    var flush = sinon.stub();

    varanus.init({
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

    varanus.init({
      flush: flush,
      flushInterval: 200
    });

    varanus.newMonitor(__filename).logTime('testService', 42);
    varanus.newMonitor(__filename).logTime('testService2', 100);

    setTimeout(function() {
      expect(flush.callCount).to.eql(1);
      var items = flush.getCall(0).args[0];
      expect(items.length).to.eql(2);

      done();
    }, 250);

  });

  it('Should not flush until it has been initialized', function() {

    varanus.newMonitor(__filename).logTime('testService', 42);

    varanus.flush();

    var flush = sinon.stub();

    varanus.init({
      flush: flush
    });

    varanus.newMonitor(__filename).logTime('testService', 100);

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    var items = flush.getCall(0).args[0];
    expect(items.length).to.eql(2);
  });

  it('Should not lose records if flush throws an error', function() {
    var flush = sinon.stub();

    flush.onCall(0).throws(new Error());
    flush.onCall(1).returns(undefined);

    varanus.init({
      flush: flush
    });

    var monitor = varanus.newMonitor(__filename);

    monitor.logTime('testService', 42);

    // This one will throw an error
    varanus.flush();

    expect(flush.callCount).to.eql(1);
    var items1 = flush.getCall(0).args[0];
    expect(items1.length).to.eql(1);

    // Send another record
    monitor.logTime('testService', 50);

    // This one should succeed
    varanus.flush();

    expect(flush.callCount).to.eql(2);
    var items2 = flush.getCall(1).args[0];
    expect(items2.length).to.eql(2); // Should have both records this time
  });

  it('Should not lose records if flush throws an error and is a promise', function(done) {
    var flush = sinon.stub();

    flush.onCall(0).returns(Promise.reject(new Error()));
    flush.onCall(1).returns(Promise.resolve());

    varanus.init({
      flush: flush
    });

    var monitor = varanus.newMonitor(__filename);

    monitor.logTime('testService', 42);

    // This one will throw an error
    varanus.flush();

    expect(flush.callCount).to.eql(1);
    var items1 = flush.getCall(0).args[0];
    expect(items1.length).to.eql(1);

    // Send another record
    monitor.logTime('testService', 50);

    setTimeout(function() {
      // This one should succeed
      varanus.flush();

      expect(flush.callCount).to.eql(2);
      var items2 = flush.getCall(1).args[0];
      expect(items2.length).to.eql(2); // Should have both records this time

      done();
    });
  });

});
