import { patchLiveService, stabilizeNetworkServices } from './NetworkSentinelPage.helpers';
import { NetworkServiceCard } from '../services/networkSentinelApi';
const service = { id:'a', status:{overall_status:'DOWN', last_checked_at:'2026-10-07T10:00:00Z',reason:'Timed out',icmp_latency_ms:20,tcp_latency_ms:30}, active_outage:{started_at:'2026-10-07T09:00:00Z'} } as NetworkServiceCard;
it('clears old failure evidence on recovery, including explicit null measurements',()=>{
 const next=patchLiveService(service,{overall_status:'UP',last_checked_at:'2026-10-07T10:00:10Z',reason:null,icmp_latency_ms:null});
 expect(next.status?.reason).toBeNull(); expect(next.status?.icmp_latency_ms).toBeNull(); expect(next.active_outage).toBeNull();
});
it('rejects out-of-order probes and stale HTTP snapshots',()=>{
 expect(patchLiveService(service,{overall_status:'UP',last_checked_at:'2026-10-07T09:59:00Z'})).toBe(service);
 const older={...service,status:{...service.status!,last_checked_at:'2026-10-07T09:59:00Z',overall_status:'UP' as const}};
 expect(stabilizeNetworkServices([older],[service])[0].status).toEqual(service.status);
});
