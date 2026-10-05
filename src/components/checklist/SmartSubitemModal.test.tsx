import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SmartSubitemModal from './SmartSubitemModal';
jest.mock('react-slick', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
const step = (status: any = 'IN_PROGRESS') => ({ id:'step-1', title:'Check service health', description:'Review the health panel.', item_type:'ROUTINE', is_required:true, severity:2, status, completed_at:null, skipped_reason:null, failure_reason:null });
const setup = (status: any = 'IN_PROGRESS') => {
  const onAction=jest.fn().mockResolvedValue(undefined), onCompleteItem=jest.fn().mockResolvedValue(undefined), onClose=jest.fn();
  render(<SmartSubitemModal isOpen itemTitle="Service checks" itemId="item-1" instanceId="run-1" subitems={[step(status)]} onAction={onAction} onCompleteItem={onCompleteItem} onClose={onClose}/>);
  return {onAction,onCompleteItem,onClose};
};
test('starting a pending step retains its action contract', async()=>{
  const {onAction}=setup('PENDING');
  expect(screen.queryByRole('button',{name:'Mark Complete'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Start Working'}));
  await waitFor(()=>expect(onAction).toHaveBeenCalledWith('step-1','IN_PROGRESS',undefined));
});
test('skip requires a reason and cancellation does not mutate the step', async()=>{
  const {onAction}=setup();
  fireEvent.click(screen.getByRole('button',{name:'Skip'}));
  const dialog=screen.getByRole('dialog',{name:'Skip subitem'});
  expect(within(dialog).getByRole('button',{name:'Skip'})).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Skip'}));
  fireEvent.change(screen.getByPlaceholderText('Enter reason for skipping...'),{target:{value:'Approved maintenance window'}});
  fireEvent.click(within(screen.getByRole('dialog',{name:'Skip subitem'})).getByRole('button',{name:'Skip'}));
  await waitFor(()=>expect(onAction).toHaveBeenCalledWith('step-1','SKIPPED','Approved maintenance window'));
});
test('failed steps still require a final verdict before completing the main item',async()=>{
  const {onCompleteItem}=setup('FAILED');
  fireEvent.click(screen.getByRole('button',{name:'Finalize'}));
  const finish=screen.getByRole('button',{name:'Complete Main Item'});
  expect(finish).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Final verdict (required)'),{target:{value:'Issue escalated to the service owner'}});
  fireEvent.click(finish);
  await waitFor(()=>expect(onCompleteItem).toHaveBeenCalledWith(undefined,'Issue escalated to the service owner'));
});
test('Escape closes the execution dialog',()=>{
  const {onClose}=setup();
  fireEvent.keyDown(screen.getByRole('dialog',{name:'Service checks'}),{key:'Escape'});
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('completing a step leaves main-item finalization explicit',async()=>{
  const {onAction,onCompleteItem}=setup();
  fireEvent.click(screen.getByRole('button',{name:'Mark Complete'}));
  await waitFor(()=>expect(onAction).toHaveBeenCalledWith('step-1','COMPLETED',undefined));
  expect(onCompleteItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Finalize'}));
  fireEvent.click(screen.getByRole('button',{name:'Complete Main Item'}));
  await waitFor(()=>expect(onCompleteItem).toHaveBeenCalledWith(undefined,undefined));
});
