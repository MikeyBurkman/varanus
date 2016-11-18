"use strict";
const x51 = require('x51');
const LEVEL_MAP = {
    trace: 10,
    debug: 20,
    info: 30,
    off: Infinity
};
function varanus(opts) {
    let _level;
    setLogLevel(opts.level || 'info');
    const _captureErrors = (opts.captureErrors === false) ? false : true;
    const _x51 = x51({
        flush: opts.flush,
        flushInterval: opts.flushInterval,
        maxRecords: opts.maxRecords,
        log: opts.log
    });
    // Public API
    const self = {
        newMonitor: newMonitor,
        flush: flush,
        setLogLevel: setLogLevel,
        logEnabled: logEnabled
    };
    return self;
    ////
    function newMonitor(monitorName) {
        const serviceName = _formatFileName(monitorName);
        const logTime = function (logLevel, fnName, startTime, endTime) {
            if (!logEnabled(logLevel)) {
                return;
            }
            return _logTime(serviceName, logLevel, fnName, startTime, endTime);
        };
        return {
            trace: (fn, fnName) => _monitor('trace', serviceName, fn, fnName),
            debug: (fn, fnName) => _monitor('debug', serviceName, fn, fnName),
            info: (fn, fnName) => _monitor('info', serviceName, fn, fnName),
            logTime: logTime
        };
    }
    function flush() {
        return _x51.flush();
    }
    function setLogLevel(level) {
        const lvl = LEVEL_MAP[level];
        if (!lvl) {
            throw new Error('Must provide a valid level attribute: ' + Object.keys(LEVEL_MAP).join(' | '));
        }
        _level = lvl;
    }
    function logEnabled(logLevel) {
        return (getLogLevelNumber(logLevel) >= _level);
    }
    // Private functions
    function getLogLevelNumber(logLevel) {
        return LEVEL_MAP[logLevel] || Infinity;
    }
    function _formatFileName(fileName) {
        const withoutRoot = fileName.replace(process.cwd(), '');
        const fileExt = withoutRoot.lastIndexOf('.');
        return (fileExt > -1) ? withoutRoot.substr(0, fileExt) : withoutRoot;
    }
    function _monitor(logLevel, serviceName, fn, fnName) {
        const name = fnName || fn.name || '<anonymous>';
        const logLevelNumber = getLogLevelNumber(logLevel);
        function finish(start, err) {
            let params;
            if (err && _captureErrors) {
                params = {
                    err: err
                };
            }
            _logTime(serviceName, logLevel, name, start, Date.now(), params);
        }
        const wrapped = function () {
            if (logLevelNumber < _level) {
                // Logging is off, just do a pass-through
                return fn.apply(undefined, arguments);
            }
            const start = Date.now();
            if (typeof arguments[arguments.length - 1] === 'function') {
                const args = Array.prototype.slice.call(arguments);
                // Async callback function
                const callback = args.pop();
                args.push(function (err) {
                    finish(start, err);
                    callback.apply(undefined, arguments);
                });
                return fn.apply(undefined, args);
            }
            else {
                let res;
                try {
                    res = fn.apply(undefined, arguments);
                }
                catch (err) {
                    finish(start, err);
                    throw err;
                }
                if (res && res.then && res.catch) {
                    // Probably (hopefully) a promise
                    return res.then(function (data) {
                        finish(start);
                        return data;
                    })
                        .catch(function (err) {
                        finish(start, err);
                        throw err;
                    });
                }
                else {
                    // Synchronous function
                    finish(start);
                    return res;
                }
            }
        };
        // Attempt to set the name of the new function
        Object.defineProperty(wrapped, 'name', {
            value: name,
            configurable: true
        });
        return wrapped;
    }
    function _logTime(monitorName, logLevel, fnName, startTime, endTime, params) {
        const item = {
            service: monitorName,
            fnName: fnName,
            time: endTime - startTime,
            level: logLevel,
            created: new Date(startTime),
            params: params || {}
        };
        _x51.push(item);
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = varanus;
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQ0EsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBTTNCLE1BQU0sU0FBUyxHQUFhO0lBQzFCLEtBQUssRUFBRSxFQUFFO0lBQ1QsS0FBSyxFQUFFLEVBQUU7SUFDVCxJQUFJLEVBQUUsRUFBRTtJQUNSLEdBQUcsRUFBRSxRQUFRO0NBQ2QsQ0FBQztBQXNDRixpQkFBZ0MsSUFBYTtJQUUzQyxJQUFJLE1BQWMsQ0FBQztJQUNuQixXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxNQUFNLENBQUMsQ0FBQztJQUVsQyxNQUFNLGNBQWMsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLEtBQUssS0FBSyxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQztJQUVyRSxNQUFNLElBQUksR0FBRyxHQUFHLENBQUM7UUFDZixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7UUFDakIsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhO1FBQ2pDLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVTtRQUMzQixHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUc7S0FDZCxDQUFDLENBQUM7SUFFSCxhQUFhO0lBQ2IsTUFBTSxJQUFJLEdBQUc7UUFDWCxVQUFVLEVBQUUsVUFBVTtRQUN0QixLQUFLLEVBQUUsS0FBSztRQUNaLFdBQVcsRUFBRSxXQUFXO1FBQ3hCLFVBQVUsRUFBRSxVQUFVO0tBQ3ZCLENBQUM7SUFFRixNQUFNLENBQUMsSUFBSSxDQUFDO0lBRVosSUFBSTtJQUVKLG9CQUFvQixXQUFtQjtRQUVyQyxNQUFNLFdBQVcsR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFakQsTUFBTSxPQUFPLEdBQUcsVUFBVSxRQUFlLEVBQUUsTUFBYyxFQUFFLFNBQWlCLEVBQUUsT0FBZTtZQUMzRixFQUFFLENBQUMsQ0FBQyxDQUFD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