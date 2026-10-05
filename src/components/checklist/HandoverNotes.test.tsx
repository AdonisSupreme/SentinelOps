import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HandoverNotes from './HandoverNotes';
import HandoverNoteModal from './HandoverNoteModal';
import ParticipantList from './ParticipantList';
import api from '../../services/api';
import { useChecklist } from '../../contexts/checklistContext';

jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../contexts/checklistContext', () => ({ useChecklist: jest.fn() }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'self' } }) }));
const note = { id:'note-1', content:'Confirm recovery with the service owner.', priority:3, created_at:'2026-10-05T09:00:00', direction:'incoming', from_shift:'NIGHT',to_shift:'MORNING',created_by_username:'operator' };
beforeEach(() => {
  (api.get as jest.Mock).mockResolvedValue({ data:{ handover_notes:[note] } });
  (api.post as jest.Mock).mockResolvedValue({});
});

test('acknowledgement retains its endpoint and visibly refreshes the receipt', async () => {
  render(<HandoverNotes instanceId="run-1" onShowModal={jest.fn()}/>);
  await screen.findByText(note.content);
  (api.get as jest.Mock).mockResolvedValue({data:{handover_notes:[{...note,acknowledged_at:'2026-10-05T10:00:00',acknowledged_by_username:'checker'}]}});
  fireEvent.click(screen.getByRole('button',{name:'Acknowledge'}));
  await screen.findByText('Acknowledged by checker');
  expect(api.post).toHaveBeenCalledWith('/api/v1/checklists/handover-notes/note-1/acknowledge');
  expect(screen.queryByRole('button',{name:'Acknowledge'})).not.toBeInTheDocument();
});

test('failed acknowledgement remains actionable and reports the failure',async()=>{
  (api.post as jest.Mock).mockRejectedValue(new Error('Offline'));
  render(<HandoverNotes instanceId="run-1" onShowModal={jest.fn()}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Acknowledge'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('not acknowledged');
  expect(screen.getByRole('button',{name:'Acknowledge'})).toBeEnabled();
});

test('a successfully created note triggers the existing creation contract and refresh notification',async()=>{
  const create=jest.fn().mockResolvedValue({}), created=jest.fn(),close=jest.fn();
  (useChecklist as jest.Mock).mockReturnValue({createHandoverNote:create});
  render(<HandoverNoteModal isOpen instanceId="run-1" onClose={close} onCreated={created}/>);
  expect(screen.getByRole('button',{name:'Create Handover Note'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Handover Note Content'),{target:{value:'  Check recovery at 14:00.  '}});
  fireEvent.click(screen.getByRole('button',{name:'High priority'}));
  fireEvent.click(screen.getByRole('button',{name:'Create Handover Note'}));
  await waitFor(()=>expect(created).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledWith('Check recovery at 14:00.',3,'run-1');
  expect(close).toHaveBeenCalledTimes(1);
});

test('the roster keeps self presence and offline members without internal node identifiers',()=>{
  render(<ParticipantList participants={[{id:'self',username:'current.operator',email:'operator@example.test',role:'operator'},{id:'other',username:'shift.lead',email:'lead@example.test',role:'lead',is_online:false}]}/>);
  expect(screen.getByText('1 online')).toBeInTheDocument();
  expect(screen.getByText('You')).toBeInTheDocument();
  expect(screen.getByText('lead · Offline')).toBeInTheDocument();
  expect(screen.queryByText(/Node /)).not.toBeInTheDocument();
});
