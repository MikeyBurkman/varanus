'use strict';
require("source-map-support/register");
const chai_1 = require("chai");
const sinon = require("sinon");
const Promise = require("bluebird");
const index_1 = require("./index");
const testFileName = '/src/test';
describe(__filename, function () {
    it('Should use the given service name in the flushed records', function () {
        const flush = sinon.stub();
        const varanus = index_1.default({
            flush: flush
        });
        varanus.newMonitor('fooService').logTime('info', 'testFn', 0, 42);
        varanus.flush();
        chai_1.expect(flush.callCount).to.eql(1);
        const items = flush.getCall(0).args[0];
        chai_1.expect(items.length).to.eql(1);
        chai_1.expect(items[0].service).to.eql('fooService');
        chai_1.expect(items[0].fnName).to.eql('testFn');
        chai_1.expect(items[0].time).to.eql(42);
        chai_1.expect(items[0].level).to.eql('info');
        chai_1.expect(items[0].created).to.eql(new Date(0));
    });
    it('Should parse a filename if it is the arg to newMonitor()', function () {
        const flush = sinon.stub();
        const varanus = index_1.default({
            flush: flush
        });
        varanus.newMonitor(__filename).logTime('info', 'testFn', 100, 142);
        varanus.flush();
        chai_1.expect(flush.callCount).to.eql(1);
        const items = flush.getCall(0).args[0];
        chai_1.expect(items.length).to.eql(1);
        chai_1.expect(items[0].service).to.eql(testFileName);
        chai_1.expect(items[0].fnName).to.eql('testFn');
        chai_1.expect(items[0].time).to.eql(42); // Difference between 142 and 42
        chai_1.expect(items[0].level).to.eql('info');
        chai_1.expect(items[0].created).to.eql(new Date(100));
    });
    it('Should wrap anonymous functions with a fnName', function () {
        const flush = sinon.stub();
        const varanus = index_1.default({
            flush: flush
        });
        const fn = varanus.newMonitor('foo').info(function (x) {
            return x + '-' + x;
        }, 'service');
        const result = fn('a');
        chai_1.expect(result).to.eql('a-a');
        varanus.flush();
        chai_1.expect(flush.callCount).to.eql(1);
        const items = flush.getCall(0).args[0];
        chai_1.expect(items.length).to.eql(1);
        chai_1.expect(items[0].service).to.eql('foo');
        chai_1.expect(items[0].fnName).to.eql('service');
        chai_1.expect(items[0].level).to.eql('info');
    });
    describe('Monitoring callback functions', function () {
        it('Should be able to monitor successful callback functions', function (done) {
            const flush = sinon.stub();
            const varanus = index_1.default({
                flush: flush
            });
            const monitor = varanus.newMonitor(__filename);
            const fn = monitor.info(function fooCallback(x, callback) {
                setTimeout(function () {
                    callback(null, x);
                }, 100);
            });
            // Verify that we set the name of the new function
            chai_1.expect(fn.name).to.eql('fooCallback');
            const n = monitor.info(function (x) {
                return 42;
            }, 'abc');
            fn('blah', function (err, result) {
                chai_1.expect(err).to.not.exist;
                chai_1.expect(result).to.eql('blah');
                varanus.flush();
                chai_1.expect(flush.callCount).to.eql(1);
                const items = flush.getCall(0).args[0];
                chai_1.expect(items.length).to.eql(1);
                chai_1.expect(items[0].service).to.eql(testFileName);
                chai_1.expect(items[0].fnName).to.eql('fooCallback');
                chai_1.expect(items[0].time).to.be.within(90, 110);
                chai_1.expect(items[0].level).to.eql('info');
                chai_1.expect(items[0]).to.have.property('created');
                chai_1.expect(items[0]).to.have.property('params').that.eql({});
                done();
            });
        });
        it('Should capture errors in callback functions', function (done) {
            const flush = sinon.stub();
            const varanus = index_1.default({
                flush: flush
            });
            const monitor = varanus.newMonitor(__filename);
            const err = new Error('some error');
            const fn = monitor.info(function fooCallback(x, callback) {
                setTimeout(function () {
                    callback(err);
                }, 100);
            });
            fn('blah', function (err, result) {
                chai_1.expect(err).to.exist;
                chai_1.expect(err.message).to.eql('some error');
                chai_1.expect(result).to.not.exist;
                varanus.flush();
                chai_1.expect(flush.callCount).to.eql(1);
                const items = flush.getCall(0).args[0];
                chai_1.expect(items.length).to.eql(1);
                chai_1.expect(items[0].service).to.eql(testFileName);
                chai_1.expect(items[0].fnName).to.eql('fooCallback');
                chai_1.expect(items[0].time).to.be.within(90, 110);
                chai_1.expect(items[0].level).to.eql('info');
                chai_1.expect(items[0]).to.have.property('created');
                chai_1.expect(items[0]).to.have.deep.property('params.err', err);
                done();
            });
        });
    });
    describe('Monitoring promise functions', function () {
        it('Should be able to monitor promise functions that resolve', function () {
            const flush = sinon.stub();
            const varanus = index_1.default({
                flush: flush
            });
            const monitor = varanus.newMonitor(__filename);
            const fn = monitor.info(function fooPromise() {
                return Promise.delay(100).return('blah');
            });
            return fn().then(function (result) {
                chai_1.expect(result).to.eql('blah');
                varanus.flush();
                chai_1.expect(flush.callCount).to.eql(1);
                const items = flush.getCall(0).args[0];
                chai_1.expect(items.length).to.eql(1);
                chai_1.expect(items[0].service).to.eql(testFileName);
                chai_1.expect(items[0].fnName).to.eql('fooPromise');
                chai_1.expect(items[0].time).to.be.within(90, 110);
                chai_1.expect(items[0].level).to.eql('info');
                chai_1.expect(items[0]).to.have.property('created');
                chai_1.expect(items[0]).to.have.property('params').that.eql({});
            });
        });
        it('Should be able to monitor promise functions that reject', function () {
            const flush = sinon.stub();
            const varanus = index_1.default({
                flush: flush
            });
            const monitor = varanus.newMonitor(__filename);
            const err = new Error('some error');
            const fn = monitor.info(function fooPromise() {
                return Promise.delay(100).throw(err);
            });
            return fn().catch({ message: 'some error' }, function () {
                varanus.flush();
                chai_1.expect(flush.callCount).to.eql(1);
                const items = flush.getCall(0).args[0];
                chai_1.expect(items.length).to.eql(1);
                chai_1.expect(items[0].service).to.eql(testFileName);
                chai_1.expect(items[0].fnName).to.eql('fooPromise');
                chai_1.expect(items[0].time).to.be.within(90, 110);
                chai_1.expect(items[0].level).to.eql('info');
                chai_1.expect(items[0]).to.have.property('created');
                chai_1.expect(items[0]).to.have.deep.property('params.err', err);
            });
        });
    });
    describe('Monitoring of synchronous functions', function () {
        it('Should be able to monitor synchronous functions that return', function () {
            const flush = sinon.stub();
            const varanus = index_1.default({
                flush: flush
            });
            const monitor = varanus.newMonitor(__filename);
            const fn = monitor.info(function foo() {
                return 42;
            });
            const res = fn();
            chai_1.expect(res).to.eql(42);
            varanus.flush();
            chai_1.expect(flush.callCount).to.eql(1);
            const items = flush.getCall(0).args[0];
            chai_1.expect(items.length).to.eql(1);
            chai_1.expect(items[0].service).to.eql(testFileName);
            chai_1.expect(items[0].fnName).to.eql('foo');
            chai_1.expect(items[0].time).to.be.within(0, 3);
            chai_1.expect(items[0].level).to.eql('info');
            chai_1.expect(items[0]).to.have.property('created');
            chai_1.expect(items[0]).to.have.property('params').that.eql({});
        });
        it('Should be able to monitor synchronous functions that throw', function () {
            const flush = sinon.stub();
            const varanus = index_1.default({
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
            }
            catch (err) {
                chai_1.expect(err.message).to.eql('some error');
            }
            varanus.flush();
            chai_1.expect(flush.callCount).to.eql(1);
            const items = flush.getCall(0).args[0];
            chai_1.expect(items.length).to.eql(1);
            chai_1.expect(items[0].service).to.eql(testFileName);
            chai_1.expect(items[0].fnName).to.eql('foo');
            chai_1.expect(items[0].time).to.be.within(0, 3);
            chai_1.expect(items[0].level).to.eql('info');
            chai_1.expect(items[0]).to.have.property('created');
            chai_1.expect(items[0]).to.have.deep.property('params.err', err);
        });
    });
    it('Should return the result of the function even when logging is disabled', function () {
        const flush = sinon.stub();
        const varanus = index_1.default({
            flush: flush,
            level: 'off'
        });
        const monitor = varanus.newMonitor(__filename);
        const fn = monitor.info(function fooSync() {
            return 'blah';
        });
        const result = fn();
        chai_1.expect(result).to.eql('blah');
        varanus.flush();
        chai_1.expect(flush.callCount).to.eql(0);
    });
    it('Should be able to monitor functions that do not return values', function () {
        const flush = sinon.stub();
        const varanus = index_1.default({
            flush: flush
        });
        const monitor = varanus.newMonitor(__filename);
        const fn = monitor.info(function fooNoReturn() {
            // noop
        });
        fn();
        varanus.flush();
        chai_1.expect(flush.callCount).to.eql(1);
        const items = flush.getCall(0).args[0];
        chai_1.expect(items.length).to.eql(1);
        chai_1.expect(items[0].service).to.eql(testFileName);
        chai_1.expect(items[0].fnName).to.eql('fooNoReturn');
        chai_1.expect(items[0]).to.have.property('created');
    });
    it('Should flush according to the flush interval', function (done) {
        const flush = sinon.stub();
        const varanus = index_1.default({
            flush: flush,
            flushInterval: 200
        });
        varanus.newMonitor(__filename).logTime('info', 'testService', 0, 42);
        varanus.newMonitor(__filename).logTime('info', 'testService2', 50, 150);
        setTimeout(function () {
            chai_1.expect(flush.callCount).to.eql(1);
            const items = flush.getCall(0).args[0];
            chai_1.expect(items.length).to.eql(2);
            done();
        }, 250);
    });
    it('Should not lose records if flush throws an error', function () {
        const flush = sinon.stub();
        flush.onCall(0).throws(new Error());
        flush.onCall(1).returns(undefined);
        const varanus = index_1.default({
            flush: flush
        });
        const monitor = varanus.newMonitor(__filename);
        monitor.logTime('info', 'testService', 0, 42);
        // This one will throw an error
        varanus.flush();
        chai_1.expect(flush.callCount).to.eql(1);
        const items1 = flush.getCall(0).args[0];
        chai_1.expect(items1.length).to.eql(1);
        // Send another record
        monitor.logTime('info', 'testService', 0, 50);
        // This one should succeed
        varanus.flush();
        chai_1.expect(flush.callCount).to.eql(2);
        const items2 = flush.getCall(1).args[0];
        chai_1.expect(items2.length).to.eql(2); // Should have both records this time
    });
    it('Should not lose records if flush returns a rejected promise', function (done) {
        const flush = sinon.stub();
        flush.onCall(0).returns(Promise.reject(new Error()));
        flush.onCall(1).returns(Promise.resolve());
        const varanus = index_1.default({
            flush: flush
        });
        const monitor = varanus.newMonitor(__filename);
        monitor.logTime('info', 'testService', 0, 42);
        // This one will throw an error
        varanus.flush();
        chai_1.expect(flush.callCount).to.eql(1);
        const items1 = flush.getCall(0).args[0];
        chai_1.expect(items1.length).to.eql(1);
        // Send another record
        monitor.logTime('info', 'testService', 0, 50);
        setTimeout(function () {
            // This one should succeed
            varanus.flush();
            chai_1.expect(flush.callCount).to.eql(2);
            const items2 = flush.getCall(1).args[0];
            chai_1.expect(items2.length).to.eql(2); // Should have both records this time
            done();
        });
    });
    it('Should not flush automatically if the number of records is below the set threshold', function () {
        const flush = sinon.stub();
        const varanus = index_1.default({
            flush: flush,
            maxRecords: 2
        });
        const monitor = varanus.newMonitor(__filename);
        monitor.logTime('info', 'testService1', 0, 42);
        chai_1.expect(flush.callCount).to.eql(0);
    });
    it('Should proactively flush if the number of records passes the set threshold', function () {
        const flush = sinon.stub();
        const varanus = index_1.default({
            flush: flush,
            maxRecords: 2
        });
        const monitor = varanus.newMonitor(__filename);
        monitor.logTime('info', 'testService1', 0, 42);
        monitor.logTime('info', 'testService2', 0, 50);
        chai_1.expect(flush.callCount).to.eql(1);
        const items = flush.getCall(0).args[0];
        chai_1.expect(items.length).to.eql(2);
    });
    describe('#Log Levels', function () {
        it('Should not log if log level is "off"', function () {
            const flush = sinon.stub();
            const varanus = index_1.default({
                flush: flush,
                level: 'off'
            });
            varanus.newMonitor('fooService').logTime('info', 'testFn', 0, 42);
            varanus.flush();
            chai_1.expect(flush.callCount).to.eql(0);
        });
        it('Should support changing the log level dynamically', function () {
            const flush = sinon.stub();
            const varanus = index_1.default({
                flush: flush,
                level: 'off'
            });
            const monitor = varanus.newMonitor('fooService');
            monitor.logTime('info', 'testFn', 0, 42);
            varanus.flush();
            chai_1.expect(flush.callCount).to.eql(0);
            // Now set to something other than 'off' and try again
            varanus.setLogLevel('info');
            monitor.logTime('info', 'testFn', 0, 42);
            varanus.flush();
            chai_1.expect(flush.callCount).to.eql(1);
            // Now set to 'off', try again, and make sure flush wasn't called again
            varanus.setLogLevel('off');
            monitor.logTime('info', 'testFn', 0, 42);
            varanus.flush();
            chai_1.expect(flush.callCount).to.eql(1); // Still 1
        });
        it('Should not include logs below the set threshold, logTime()', function () {
            const flush = sinon.stub();
            const varanus = index_1.default({
                flush: flush,
                level: 'debug'
            });
            const monitor = varanus.newMonitor(__filename);
            monitor.logTime('trace', 'testService1', 0, 42); // Shouldn't be logged
            monitor.logTime('debug', 'testService2', 0, 43);
            monitor.logTime('info', 'testService3', 0, 44);
            varanus.flush();
            chai_1.expect(flush.callCount).to.eql(1);
            const items = flush.getCall(0).args[0];
            chai_1.expect(items.length).to.eql(2); // Leave out trace
        });
        it('Should not include logs below the set threshold, using monitor()', function () {
            const flush = sinon.stub();
            const varanus = index_1.default({
                flush: flush,
                level: 'debug'
            });
            const monitor = varanus.newMonitor(__filename);
            const fn1 = monitor.trace(function fn1() { });
            const fn2 = monitor.debug(function fn2() { });
            const fn3 = monitor.info(function fn3() { });
            fn1(); // Shouldn't be logged
            fn2();
            fn3();
            varanus.flush();
            chai_1.expect(flush.callCount).to.eql(1);
            const items = flush.getCall(0).args[0];
            chai_1.expect(items.length).to.eql(2); // Leave out trace
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWSxDQUFDO0FBRWIsdUNBQXFDO0FBRXJDLCtCQUE0QjtBQUM1QiwrQkFBK0I7QUFDL0Isb0NBQW9DO0FBRXBDLG1DQUFnQztBQUVoQyxNQUFNLFlBQVksR0FBRyxXQUFXLENBQUE7QUFFaEMsUUFBUSxDQUFDLFVBQVUsRUFBRTtJQUVuQixFQUFFLENBQUMsMERBQTBELEVBQUU7UUFDN0QsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBRTNCLE1BQU0sT0FBTyxHQUFHLGVBQVMsQ0FBQztZQUN4QixLQUFLLEVBQUUsS0FBSztTQUNiLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWxFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUVoQixhQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFbEMsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkMsYUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9CLGFBQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM5QyxhQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxD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