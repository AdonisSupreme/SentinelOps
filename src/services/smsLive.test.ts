import {subscribeSmsEvents} from './smsLive';

jest.mock('../config/env', () => ({NEXUS_API_BASE_URL:'http://api.test'}));
const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
const encode = (text:string) => Uint8Array.from(Array.from(text).map(char=>char.charCodeAt(0)));
beforeEach(() => {
  jest.useFakeTimers();
  (global as any).TextDecoder = require('util').TextDecoder;
  localStorage.setItem('token','test-token');
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('authenticated stream parses split frames and cancels on unsubscribe', async () => {
  const changed=jest.fn(), mode=jest.fn(), cancel=jest.fn().mockResolvedValue(undefined);
  const chunks=['data: {"revision":1,','"mode":"realtime"}\n\n: heartbeat\n\n','data: {"revision":2,"mode":"polling"}\n\n'];
  const fetchMock=jest.fn().mockImplementation((_url,options) => Promise.resolve({ok:true,headers:{get:()=> 'text/event-stream'},body:{getReader:()=>({
    cancel,
    read:()=>chunks.length ? Promise.resolve({done:false,value:encode(chunks.shift()!)}) : new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')))),
  })}}));
  global.fetch=fetchMock;
  const stop=subscribeSmsEvents(changed,mode);
  await flush();
  expect(changed.mock.calls.map(args=>args[0])).toEqual([{revision:1,mode:'realtime'},{revision:2,mode:'polling'}]);
  expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/v1/nexus/reports/sms/events');
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  stop(); await flush();
  expect(cancel).toHaveBeenCalled();
  jest.advanceTimersByTime(30000); await flush();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('stream failure is visible and reconnect uses the latest token', async () => {
  const mode=jest.fn();
  const fetchMock=jest.fn().mockRejectedValue(new Error('disconnected')); global.fetch=fetchMock;
  const stop=subscribeSmsEvents(jest.fn(),mode);
  await flush();
  expect(mode).toHaveBeenCalledWith('unavailable');
  localStorage.setItem('token','renewed-token');
  jest.advanceTimersByTime(1000); await flush();
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer renewed-token');
  stop();
});
