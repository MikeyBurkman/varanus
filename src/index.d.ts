export declare type Level = 'trace' | 'debug' | 'info';
export interface Record {
    service: string;
    fnName: string;
    time: number;
    level: Level;
    created: Date;
    params: any;
}
export interface Options {
    level?: Level | 'off';
    flush: (records: Record[]) => void;
    flushInterval?: number;
    maxRecords?: number;
    log?: any;
    captureErrors?: boolean;
}
export declare type MonitorFn = <T extends Function>(fn: T, fnName?: string) => T;
export interface Monitor {
    logTime: (logLevel: Level, fnName: string, startTime: number, endTime: number) => void;
    trace: MonitorFn;
    debug: MonitorFn;
    info: MonitorFn;
}
export default function (opts: Options): {
    newMonitor: (monitorName: string) => Monitor;
    flush: () => void;
    setLogLevel: (level: "trace" | "debug" | "info" | "off") => void;
    logEnabled: (logLevel: Level) => boolean;
};
