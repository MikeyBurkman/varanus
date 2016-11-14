'use strict';

import 'source-map-support/register';

import {expect} from 'chai';
import * as sinon from 'sinon';
import * as Promise from 'bluebird';

import varanusFn from './index';

const testFileName = '/src/test'

describe(__filename, function() {

  it('Should use the given service name in the flushed records', function() {
    const flush = sinon.stub();

    const varanus = varanusFn({
      flush: flush
    });

    varanus.newMonitor('fooService').logTime('info', 'testFn', 0, 42);

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    const items = flush.getCall(0).args[0];
    expect(items.length).to.eql(1);
    expect(items[0].service).to.eql('fooService');
    expect(items[0].fnName).to.eql('testFn');
    expect(items[0].time).to.eql(42);
    expect(items[0].level).to.eql('info');
    expect(items[0].created).to.eql(new Date(0));
  });

  it('Should parse a filename if it is the arg to newMonitor()', function() {
    const flush = sinon.stub();

    const varanus = varanusFn({
      flush: flush
    });

    varanus.newMonitor(__filename).logTime('info', 'testFn', 100, 142);

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    const items = flush.getCall(0).args[0];
    expect(items.length).to.eql(1);
    expect(items[0].service).to.eql(testFileName);
    expect(items[0].fnName).to.eql('testFn');
    expect(items[0].time).to.eql(42); // Difference between 142 and 42
    expect(items[0].level).to.eql('info');
    expect(items[0].created).to.eql(new Date(100));
  });

  it('Should wrap anonymous functions with a fnName', function() {
    const flush = sinon.stub();

    const varanus = varanusFn({
      flush: flush
    });

    const fn = varanus.newMonitor('foo').info(function(x: string): string {
      return x + '-' + x;
    }, 'service');

    const result = fn('a');

    expect(result).to.eql('a-a');

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    const items = flush.getCall(0).args[0];
    expect(items.length).to.eql(1);
    expect(items[0].service).to.eql('foo');
    expect(items[0].fnName).to.eql('service');
    expect(items[0].level).to.eql('info');
  });

  describe('Monitoring callback functions', function() {
    it('Should be able to monitor successful callback functions', function(done) {
      const flush = sinon.stub();

      const varanus = varanusFn({
        flush: flush
      });

      const monitor = varanus.newMonitor(__filename);

      const fn = monitor.info(function fooCallback(x: any, callback: (err: any, result?: any) => void) {
        setTimeout(function() {
          callback(null, x);
        }, 100);
      });

      // Verify that we set the name of the new function
      expect(fn.name).to.eql('fooCallback');

      const n = monitor.info(function(x: string): number {
        return 42;
      }, 'abc');

      fn('blah', function(err, result) {
        expect(err).to.not.exist;
        expect(result).to.eql('blah');

        varanus.flush();

        expect(flush.callCount).to.eql(1);

        const items = flush.getCall(0).args[0];
        expect(items.length).to.eql(1);
        expect(items[0].service).to.eql(testFileName);
        expect(items[0].fnName).to.eql('fooCallback');
        expect(items[0].time).to.be.within(90, 110);
        expect(items[0].level).to.eql('info');
        expect(items[0]).to.have.property('created');
        expect(items[0]).to.have.property('params').that.eql({});

        done();
      });

    });

    it('Should capture errors in callback functions', function(done) {
      const flush = sinon.stub();

      const varanus = varanusFn({
        flush: flush
      });

      const monitor = varanus.newMonitor(__filename);

      const err = new Error('some error');
      const fn = monitor.info(function fooCallback(x: any, callback: (err: any, result?: any) => void) {
        setTimeout(function() {
          callback(err);
        }, 100);
      });

      fn('blah', function(err, result) {
        expect(err).to.exist;
        expect(err.message).to.eql('some error');
        expect(result).to.not.exist;

        varanus.flush();

        expect(flush.callCount).to.eql(1);

        const items = flush.getCall(0).args[0];
        expect(items.length).to.eql(1);
        expect(items[0].service).to.eql(testFileName);
        expect(items[0].fnName).to.eql('fooCallback');
        expect(items[0].time).to.be.within(90, 110);
        expect(items[0].level).to.eql('info');
        expect(items[0]).to.have.property('created');
        expect(items[0]).to.have.deep.property('params.err', err);

        done();
      });
    });
  });

  describe('Monitoring promise functions', function() {
    it('Should be able to monitor promise functions that resolve', function() {
      const flush = sinon.stub();

      const varanus = varanusFn({
        flush: flush
      });

      const monitor = varanus.newMonitor(__filename);

      const fn = monitor.info(function fooPromise() {
        return Promise.delay(100).return('blah');
      });

      return fn().then(function(result) {
        expect(result).to.eql('blah');

        varanus.flush();

        expect(flush.callCount).to.eql(1);

        const items = flush.getCall(0).args[0];
        expect(items.length).to.eql(1);
        expect(items[0].service).to.eql(testFileName);
        expect(items[0].fnName).to.eql('fooPromise');
        expect(items[0].time).to.be.within(90, 110);
        expect(items[0].level).to.eql('info');
        expect(items[0]).to.have.property('created');
        expect(items[0]).to.have.property('params').that.eql({});

      });
    });

    it('Should be able to monitor promise functions that reject', function() {
      const flush = sinon.stub();

      const varanus = varanusFn({
        flush: flush
      });

      const monitor = varanus.newMonitor(__filename);

      const err = new Error('some error');
      const fn = monitor.info(function fooPromise() {
        return Promise.delay(100).throw(err);
      });

      return fn().catch({message: 'some error'}, function() {
        varanus.flush();

        expect(flush.callCount).to.eql(1);

        const items = flush.getCall(0).args[0];
        expect(items.length).to.eql(1);
        expect(items[0].service).to.eql(testFileName);
        expect(items[0].fnName).to.eql('fooPromise');
        expect(items[0].time).to.be.within(90, 110);
        expect(items[0].level).to.eql('info');
        expect(items[0]).to.have.property('created');
        expect(items[0]).to.have.deep.property('params.err', err);

      });
    });
  });

  describe('Monitoring of synchronous functions', function() {
    it('Should be able to monitor synchronous functions that return', function() {
      const flush = sinon.stub();

      const varanus = varanusFn({
        flush: flush
      });

      const monitor = varanus.newMonitor(__filename);

      const fn = monitor.info(function foo(): number {
        return 42;
      });

      const res = fn();
      expect(res).to.eql(42);

      varanus.flush();

      expect(flush.callCount).to.eql(1);

      const items = flush.getCall(0).args[0];
      expect(items.length).to.eql(1);
      expect(items[0].service).to.eql(testFileName);
      expect(items[0].fnName).to.eql('foo');
      expect(items[0].time).to.be.within(0, 3);
      expect(items[0].level).to.eql('info');
      expect(items[0]).to.have.property('created');
      expect(items[0]).to.have.property('params').that.eql({});

    });

    it('Should be able to monitor synchronous functions that throw', function() {
      const flush = sinon.stub();

      const varanus = varanusFn({
        flush: flush
      });

      const monitor = varanus.newMonitor(__filename);

      const err = new Error('some error');
      const fn = monitor.info(function foo() {
        throw err;
      });

      try {
        fn();
        throw new Error('fn() should have failed');
      } catch(err) {
        expect(err.message).to.eql('some error');
      }

      varanus.flush();

      expect(flush.callCount).to.eql(1);

      const items = flush.getCall(0).args[0];
      expect(items.length).to.eql(1);
      expect(items[0].service).to.eql(testFileName);
      expect(items[0].fnName).to.eql('foo');
      expect(items[0].time).to.be.within(0, 3);
      expect(items[0].level).to.eql('info');
      expect(items[0]).to.have.property('created');
      expect(items[0]).to.have.deep.property('params.err', err);

    });
  });

  it('Should return the result of the function even when logging is disabled', function() {
    const flush = sinon.stub();

    const varanus = varanusFn({
      flush: flush,
      level: 'off'
    });

    const monitor = varanus.newMonitor(__filename);

    const fn = monitor.info(function fooSync(): string {
      return 'blah';
    });

    const result = fn();

    expect(result).to.eql('blah');

    varanus.flush();

    expect(flush.callCount).to.eql(0);
  });

  it('Should be able to monitor functions that do not return values', function() {
    const flush = sinon.stub();

    const varanus = varanusFn({
      flush: flush
    });

    const monitor = varanus.newMonitor(__filename);

    const fn = monitor.info(function fooNoReturn() {
      // noop
    });

    fn();

    varanus.flush();

    expect(flush.callCount).to.eql(1);

    const items = flush.getCall(0).args[0];
    expect(items.length).to.eql(1);
    expect(items[0].service).to.eql(testFileName);
    expect(items[0].fnName).to.eql('fooNoReturn');
    expect(items[0]).to.have.property('created');
  });

  it('Should flush according to the flush interval', function(done) {
    const flush = sinon.stub();

    const varanus = varanusFn({
      flush: flush,
      flushInterval: 200
    });

    varanus.newMonitor(__filename).logTime('info', 'testService', 0, 42);
    varanus.newMonitor(__filename).logTime('info', 'testService2', 50, 150);

    setTimeout(function() {
      expect(flush.callCount).to.eql(1);
      const items = flush.getCall(0).args[0];
      expect(items.length).to.eql(2);

      done();
    }, 250);

  });

  it('Should not lose records if flush throws an error', function() {
    const flush = sinon.stub();

    flush.onCall(0).throws(new Error());
    flush.onCall(1).returns(undefined);

    const varanus = varanusFn({
      flush: flush
    });

    const monitor = varanus.newMonitor(__filename);

    monitor.logTime('info', 'testService', 0, 42);

    // This one will throw an error
    varanus.flush();

    expect(flush.callCount).to.eql(1);
    const items1 = flush.getCall(0).args[0];
    expect(items1.length).to.eql(1);

    // Send another record
    monitor.logTime('info', 'testService', 0, 50);

    // This one should succeed
    varanus.flush();

    expect(flush.callCount).to.eql(2);
    const items2 = flush.getCall(1).args[0];
    expect(items2.length).to.eql(2); // Should have both records this time
  });

  it('Should not lose records if flush returns a rejected promise', function(done) {
    const flush = sinon.stub();

    flush.onCall(0).returns(Promise.reject(new Error()));
    flush.onCall(1).returns(Promise.resolve());

    const varanus = varanusFn({
      flush: flush
    });

    const monitor = varanus.newMonitor(__filename);

    monitor.logTime('info', 'testService', 0, 42);

    // This one will throw an error
    varanus.flush();

    expect(flush.callCount).to.eql(1);
    const items1 = flush.getCall(0).args[0];
    expect(items1.length).to.eql(1);

    // Send another record
    monitor.logTime('info', 'testService', 0, 50);

    setTimeout(function() {
      // This one should succeed
      varanus.flush();

      expect(flush.callCount).to.eql(2);
      const items2 = flush.getCall(1).args[0];
      expect(items2.length).to.eql(2); // Should have both records this time

      done();
    });
  });

  it('Should not flush automatically if the number of records is below the set threshold', function() {
    const flush = sinon.stub();

    const varanus = varanusFn({
      flush: flush,
      maxRecords: 2
    });

    const monitor = varanus.newMonitor(__filename);

    monitor.logTime('info', 'testService1', 0, 42);

    expect(flush.callCount).to.eql(0);
  });

  it('Should proactively flush if the number of records passes the set threshold', function() {
    const flush = sinon.stub();

    const varanus = varanusFn({
      flush: flush,
      maxRecords: 2
    });

    const monitor = varanus.newMonitor(__filename);

    monitor.logTime('info', 'testService1', 0, 42);
    monitor.logTime('info', 'testService2', 0, 50);

    expect(flush.callCount).to.eql(1);
    const items = flush.getCall(0).args[0];
    expect(items.length).to.eql(2);
  });

  describe('#Log Levels', function() {
    it('Should not log if log level is "off"', function() {
      const flush = sinon.stub();

      const varanus = varanusFn({
        flush: flush,
        level: 'off'
      });

      varanus.newMonitor('fooService').logTime('info', 'testFn', 0, 42);

      varanus.flush();

      expect(flush.callCount).to.eql(0);
    });

    it('Should support changing the log level dynamically', function() {
      const flush = sinon.stub();

      const varanus = varanusFn({
        flush: flush,
        level: 'off'
      });

      const monitor = varanus.newMonitor('fooService');

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
      const flush = sinon.stub();

      const varanus = varanusFn({
        flush: flush,
        level: 'debug'
      });

      const monitor = varanus.newMonitor(__filename);

      monitor.logTime('trace', 'testService1', 0, 42); // Shouldn't be logged
      monitor.logTime('debug', 'testService2', 0, 43);
      monitor.logTime('info', 'testService3', 0, 44);

      varanus.flush();

      expect(flush.callCount).to.eql(1);
      const items = flush.getCall(0).args[0];
      expect(items.length).to.eql(2); // Leave out trace
    });

    it('Should not include logs below the set threshold, using monitor()', function() {
      const flush = sinon.stub();

      const varanus = varanusFn({
        flush: flush,
        level: 'debug'
      });

      const monitor = varanus.newMonitor(__filename);

      const fn1 = monitor.trace(function fn1() {});
      const fn2 = monitor.debug(function fn2() {});
      const fn3 = monitor.info(function fn3() {});

      fn1(); // Shouldn't be logged
      fn2();
      fn3();

      varanus.flush();

      expect(flush.callCount).to.eql(1);
      const items = flush.getCall(0).args[0];
      expect(items.length).to.eql(2); // Leave out trace
    });
  });

});
