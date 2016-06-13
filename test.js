'use strict';

var expect = require('chai').expect;
var sinon = require('sinon');
var Promise = require('bluebird');

describe(__filename, function() {

  var varanus;

  beforeEach(function() {
    delete require.cache[require.resolve('./index')];
    varanus = require('./index');
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
      expect(items[0].name).to.eql('/test-fooCallback');
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
      expect(items[0].name).to.eql('/test-fooPromise');
      expect(items[0].time).to.be.within(200, 250);
      expect(items[0]).to.have.property('created');

    });
  });

  it('It should parse the filename as a monitor', function() {
    var flush = sinon.stub();

    varanus.init({
      flush: flush
    });

    varanus.newMonitor(__filename).logTime('testService', 42);

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    var items = flush.getCall(0).args[0];
    expect(items.length).to.eql(1);
    expect(items[0].name).to.eql('/test-testService');
    expect(items[0].time).to.eql(42);
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

});
