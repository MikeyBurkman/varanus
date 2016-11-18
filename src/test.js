'use strict';
require('source-map-support/register');
const chai_1 = require('chai');
const sinon = require('sinon');
const Promise = require('bluebird');
const index_1 = require('./index');
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
        chai_1.expect(fn.name).to.eql('service');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWSxDQUFDO0FBRWIsUUFBTyw2QkFBNkIsQ0FBQyxDQUFBO0FBRXJDLHVCQUFxQixNQUFNLENBQUMsQ0FBQTtBQUM1QixNQUFZLEtBQUssV0FBTSxPQUFPLENBQUMsQ0FBQTtBQUMvQixNQUFZLE9BQU8sV0FBTSxVQUFVLENBQUMsQ0FBQTtBQUVwQyx3QkFBd0IsU0FBUyxDQUFDLENBQUE7QUFFbEMsTUFBTSxZQUFZLEdBQUcsV0FBVyxDQUFBO0FBRWhDLFFBQVEsQ0FBQyxVQUFVLEVBQUU7SUFFbkIsRUFBRSxDQUFDLDBEQUEwRCxFQUFFO1FBQzdELE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUUzQixNQUFNLE9BQU8sR0FBRyxlQUFXLENBQUM7WUFDMUIsS0FBSyxFQUFFLEtBQUs7U0FDYixDQUFDLENBQUM7UUFFSCxPQUFPLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVsRSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFaEIsYUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRWxDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZDLGFBQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvQixhQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsWUFBWSxD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