import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NetworkSentinelPage from './NetworkSentinelPage';
import { networkSentinelApi } from '../services/networkSentinelApi';
jest.mock('../contexts/AccessContext',()=>({useAccess:()=>({canAccessModule:()=>true}),ModuleAccess:({children}:any)=>children}));
jest.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{role:'admin'}})}));
jest.mock('../contexts/AppConfigContext',()=>({useAppConfig:()=>({applicationTimeZone:'Africa/Johannesburg'})}));
jest.mock('../contexts/NotificationContext',()=>({useNotifications:()=>({addNotification:jest.fn()})}));
jest.mock('../components/ui/PageGuide',()=>()=>null);
jest.mock('../services/networkLive',()=>({connectNetworkStream:()=>()=>{}}));
jest.mock('../services/networkSentinelApi',()=>({networkSentinelApi:{getCommandCenter:jest.fn(),getServiceInvestigation:jest.fn(),checkNow:jest.fn()}}));
// CRA's Jest resolver predates package exports; use the installed router's CJS entry.
jest.mock('react-router-dom',()=>{
 const util=require('util');
 Object.assign(global,{TextEncoder:util.TextEncoder,TextDecoder:util.TextDecoder});
 return jest.requireActual('react-router');
},{virtual:true});
const api=networkSentinelApi as jest.Mocked<typeof networkSentinelApi>;
const makeService=(id:string,name:string,status='UP')=>({id,name,address:'10.10.0.'+id,port:443,enabled:true,check_icmp:true,check_tcp:true,target_kind:'SERVICE',allow_ttl_expired:false,timeout_ms:3000,interval_seconds:10,environment:'Production',group_name:'Core services',tags:[],created_at:null,updated_at:null,status:{overall_status:status,last_checked_at:new Date().toISOString(),icmp_latency_ms:12,tcp_latency_ms:18,reason:status==='UP'?null:'TCP connection timed out'},metrics:{uptime_percent_24h:99.8,total_samples_24h:1400}});
const a=makeService('1','Core banking gateway'), b=makeService('2','Payments switch','DEGRADED');
const detail=(service:any)=>({service,metrics:{availability_percent_24h:99.8,avg_icmp_latency_ms_24h:12},samples:[{timestamp:new Date().toISOString(),overall_status:service.status.overall_status,icmp_latency_ms:12,tcp_latency_ms:18}],events:[],outages:[],raw_rows:[],retention:{raw_history_days:2}});
beforeEach(()=>{jest.clearAllMocks();api.getCommandCenter.mockResolvedValue({services:[a,b],overview:{total_services:2,recent_event_count:0},engine:{online:true},retention:{raw_history_days:2,event_history_days:14},active_outages:[],recent_events:[]} as any);});
it('keeps selected service evidence correct when responses arrive out of order',async()=>{
 let finishA:(value:any)=>void=()=>{};
 api.getServiceInvestigation.mockImplementation(async id=>id==='1'?await new Promise<any>(resolve=>{finishA=resolve;}):detail(b) as any);
 render(<MemoryRouter initialEntries={['/network-sentinel?service=1']}><NetworkSentinelPage/></MemoryRouter>);
 await waitFor(()=>expect(api.getServiceInvestigation).toHaveBeenCalledWith('1'));
 fireEvent.click(screen.getByRole('button',{name:/Payments switch/}));
 await waitFor(()=>expect(screen.getByRole('heading',{level:2,name:'Payments switch'})).toBeInTheDocument());
 finishA(detail(a));
 await waitFor(()=>expect(screen.getByRole('heading',{level:2,name:'Payments switch'})).toBeInTheDocument());
 expect(api.getCommandCenter).toHaveBeenCalledTimes(1);
});
it('renders fleet, filters and service editor without persisting changes',async()=>{
 api.getServiceInvestigation.mockResolvedValue(detail(a) as any);
 const view=render(<MemoryRouter initialEntries={['/network-sentinel?service=1']}><NetworkSentinelPage/></MemoryRouter>);
 await screen.findByRole('heading',{level:2,name:'Core banking gateway'});
 await waitFor(()=>expect(screen.queryByText(/Loading retained evidence/)).not.toBeInTheDocument());
 if(process.env.NETWORK_PREVIEW){
  const fs=require('fs'),path=require('path');
  const css=['NetworkSentinelPage.css','NetworkSentinelRefresh.css'].map(name=>fs.readFileSync(path.join(__dirname,name),'utf8')).join('\n');
  fs.writeFileSync(path.resolve('../.tmp/network-preview.html'),`<!doctype html><html data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}</style><style>${css}</style><body>${view.container.innerHTML}</body></html>`);
 }
 fireEvent.change(screen.getByLabelText('Status'),{target:{value:'DOWN'}});
 expect(screen.getByText('No services match these filters.')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Add Service'}));
 expect(screen.getByRole('dialog',{name:'Add monitored service'})).toBeInTheDocument();
 fireEvent.keyDown(document,{key:'Escape'});
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('shows a manual probe outcome without replacing scheduled monitor status',async()=>{
 api.getServiceInvestigation.mockResolvedValue(detail(a) as any);
 api.checkNow.mockResolvedValue({overall_status:'DOWN',reason:'Manual probe timed out',checked_at:new Date().toISOString()} as any);
 render(<MemoryRouter initialEntries={['/network-sentinel?service=1']}><NetworkSentinelPage/></MemoryRouter>);
 await screen.findByRole('heading',{level:2,name:'Core banking gateway'});
 fireEvent.click(screen.getByRole('button',{name:'Check now'}));
 await screen.findByText(/Manual check.*DOWN/);
 expect(api.checkNow).toHaveBeenCalledWith('1');
 expect(screen.getByText(/Manual probe timed out/)).toBeInTheDocument();
 expect(screen.getByRole('button',{name:/Core banking gateway UP/})).toBeInTheDocument();
});
