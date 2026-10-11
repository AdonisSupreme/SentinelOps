import { connectNetworkStream } from './networkLive';
class FakeSocket {
  static CLOSED = 3;
  static instances: FakeSocket[] = [];
  readyState = 1;
  onmessage: any; onclose: any; onerror: any;
  constructor(public url: string) { FakeSocket.instances.push(this); }
  close() { this.readyState = 3; this.onclose?.({code:1000}); }
  frame(data: any) { this.onmessage?.({data:JSON.stringify(data)}); }
}
const original = global.WebSocket;
beforeEach(() => { jest.useFakeTimers(); FakeSocket.instances=[]; global.WebSocket=FakeSocket as any; });
afterEach(() => { jest.useRealTimers(); global.WebSocket=original; });
it('delivers simultaneous updates for distinct services and heartbeats', () => {
  const receive=jest.fn(), state=jest.fn(); const stop=connectNetworkStream('ws://test',receive,state);
  FakeSocket.instances[0].frame({type:'SERVICE_STATUS_UPDATED',data:{service_id:'a'}});
  FakeSocket.instances[0].frame({type:'SERVICE_STATUS_UPDATED',data:{service_id:'b'}});
  expect(receive).toHaveBeenCalledTimes(2); expect(state).toHaveBeenLastCalledWith('live'); stop();
});
it('reconnects dropped streams and cancels reconnects on unmount', () => {
  const stop=connectNetworkStream('ws://test',jest.fn(),jest.fn());
  FakeSocket.instances[0].close(); jest.advanceTimersByTime(1000);
  expect(FakeSocket.instances).toHaveLength(2);
  FakeSocket.instances[1].close(); stop(); jest.advanceTimersByTime(60000);
  expect(FakeSocket.instances).toHaveLength(2);
});
it('does not retry revoked access', () => {
  const state=jest.fn(); const stop=connectNetworkStream('ws://test',jest.fn(),state);
  FakeSocket.instances[0].onclose({code:1008}); jest.advanceTimersByTime(30000);
  expect(state).toHaveBeenLastCalledWith('denied'); expect(FakeSocket.instances).toHaveLength(1); stop();
});
it('reconnects a silent socket but keeps a heartbeat-fed socket alive', () => {
  const stop=connectNetworkStream('ws://test',jest.fn(),jest.fn());
  for(let i=0;i<5;i++){ jest.advanceTimersByTime(15000); FakeSocket.instances[0].frame({type:'HEARTBEAT'}); }
  expect(FakeSocket.instances).toHaveLength(1);
  jest.advanceTimersByTime(51000); expect(FakeSocket.instances).toHaveLength(2); stop();
});
