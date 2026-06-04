export const SECTION_MANUAL_ID = '7bd4144d-68d8-4ac3-897d-245941612daf';
export const SENTINEL_MANUAL_PDF_PATH = '/manual/SentinelOps_User_Manual.pdf';

export type ManualVisualType =
  | 'dashboard'
  | 'timeline'
  | 'checklistHeader'
  | 'itemActions'
  | 'subitems'
  | 'handover'
  | 'taskCenter'
  | 'finalize'
  | 'templates'
  | 'schedule'
  | 'network'
  | 'trustlink'
  | 'settings';

export interface ManualPrinciple {
  title: string;
  body: string;
}

export interface ManualJourneyStep {
  step: string;
  title: string;
  location: string;
  actionLabel: string;
  body: string;
  checklist: string[];
  safety: string;
  visual: ManualVisualType;
}

export interface ManualDecisionRule {
  title: string;
  useWhen: string;
  doThis: string;
  evidence: string;
}

export interface ManualModule {
  title: string;
  route: string;
  routeLabel: string;
  visual: ManualVisualType;
  question: string;
  when: string;
  checklist: string[];
  avoid: string;
}

export interface ManualHabit {
  title: string;
  body: string;
}

export const sentinelManual = {
  eyebrow: 'SentinelOps User Manual',
  title: 'Guided Operator Manual',
  edition: 'Operator edition | June 2026',
  intro:
    'A practical, visual walkthrough for using SentinelOps without needing someone beside you. It shows where to begin, which button to press, what to write, when to skip, when to report, how to hand over, and how to close work cleanly.',
  downloadLabel: 'Download PDF manual',
  heroStats: [
    { label: 'Start here', value: 'Dashboard' },
    { label: 'Work here', value: 'Live Checklist' },
    { label: 'Hand over here', value: 'Handover Notes' },
    { label: 'Close here', value: 'Complete Checklist' },
  ],
  openingSequence: [
    'Read the Dashboard before touching live work.',
    'Join the checklist when you are actively participating.',
    'Work every item from Start Working through Complete, Skip, or Report Issue.',
    'Write handover notes before context leaves your head.',
    'Finalize only when the checklist record tells the truth.',
  ],
  principles: [
    {
      title: 'One place for the truth',
      body:
        'Live execution belongs in the checklist. Longer follow-up belongs in Task Center. Coverage belongs in schedule tools. Keeping work in the right place is what makes SentinelOps easy to trust.',
    },
    {
      title: 'Every exception needs a reason',
      body:
        'Skipping or reporting an issue is allowed, but silence is not. The reason becomes the audit trail, the handover cue, and the clue the next operator needs.',
    },
    {
      title: 'Handover is part of the work',
      body:
        'A shift is not clean just because items are clicked. The next operator must inherit decisions, blockers, risks, and unfinished follow-up in writing.',
    },
    {
      title: 'Close from evidence',
      body:
        'SentinelOps derives the final checklist outcome from actual item and subitem evidence. A clean close and a close with exceptions mean different things, and the manual teaches both.',
    },
  ] as ManualPrinciple[],
  operatorJourney: [
    {
      step: '01',
      title: 'Sign in and confirm your lane',
      location: 'Login, profile menu, and Profile Settings',
      actionLabel: 'Open Profile Settings if your access looks wrong',
      body:
        'After signing in, confirm that SentinelOps recognizes your role, section, schedule access, and theme. Your role decides whether you mainly execute, supervise, or administer.',
      checklist: [
        'Confirm your name and role in the profile menu.',
        'Open Profile Settings when section, role, or schedule information looks wrong.',
        'Ask an admin to fix role or section placement instead of working around missing access.',
      ],
      safety:
        'If you cannot see a checklist, team, schedule, or user-management page you should own, stop and fix access first.',
      visual: 'settings',
    },
    {
      step: '02',
      title: 'Read the day before acting',
      location: 'Dashboard',
      actionLabel: 'Start from Dashboard',
      body:
        'Dashboard is the quickest answer to what kind of day the operation is having. Read posture, shift pressure, command threads, and handover summary before opening detailed work.',
      checklist: [
        'Scan operational state and critical signals first.',
        'Check Shift Radar to see which shift has pressure.',
        'Open the command thread or checklist that matches the active pressure.',
      ],
      safety:
        'Do not start in history when you are trying to solve the current day. The Dashboard points you to the live source faster.',
      visual: 'dashboard',
    },
    {
      step: '03',
      title: 'Open the right checklist',
      location: 'Checklist Timeline or Dashboard command card',
      actionLabel: 'Open Checklist Timeline when you need history',
      body:
        'Use the timeline to find a checklist by date, shift, status, or pattern. Use Dashboard when you already know the current live work needs attention.',
      checklist: [
        'Choose Day view for a known event.',
        'Use Week or Date Range when you are studying repeated issues.',
        'Open the exact checklist instance only after filters tell a narrow story.',
      ],
      safety:
        'If the goal is execution, move into the live checklist. If the goal is review, stay in the timeline until the record is clear.',
      visual: 'timeline',
    },
    {
      step: '04',
      title: 'Join before you work',
      location: 'Live Checklist header',
      actionLabel: 'Click Join Checklist',
      body:
        'Join the checklist when you are taking part in the shift work. This keeps participant presence accurate and tells supervisors who is actually involved.',
      checklist: [
        'Open the live checklist.',
        'Click Join Checklist if the button is visible.',
        'Confirm the Team Members panel shows your presence.',
      ],
      safety:
        'If you are only reviewing, you do not need to join. Join when your actions will change the operational record.',
      visual: 'checklistHeader',
    },
    {
      step: '05',
      title: 'Read handover before executing',
      location: 'Right sidebar, Handover Notes',
      actionLabel: 'Open Handover Notes',
      body:
        'Before touching items, read incoming handover notes. They explain what the previous shift left behind, what is risky, and what must not be repeated blindly.',
      checklist: [
        'Open Handover Notes in the right sidebar.',
        'Acknowledge incoming notes when the note is for your shift.',
        'Keep the Team Members panel nearby when coordination matters.',
      ],
      safety:
        'If a note describes unresolved risk, do not mark related work complete until the risk has been checked or moved into Task Center.',
      visual: 'handover',
    },
    {
      step: '06',
      title: 'Start the item you are actually working',
      location: 'Item Actions modal',
      actionLabel: 'Click Start Working',
      body:
        'Open the item, select Start Working, add a short note if useful, and confirm. Items with subitems will move into the guided subitem flow.',
      checklist: [
        'Open the item card you intend to work.',
        'Click Start Working.',
        'Add start notes when another operator would benefit from context.',
      ],
      safety:
        'Do not start several items just to reserve them. Start means active work, not intention.',
      visual: 'itemActions',
    },
    {
      step: '07',
      title: 'Work subitems in order',
      location: 'Smart Subitem modal',
      actionLabel: 'Use Start Working, Mark Complete, Skip, or Report Issue',
      body:
        'Subitems are the guided path inside a detailed item. The modal shows step count, progress, actionable buttons, and final completion notes when all subitems are actioned.',
      checklist: [
        'Use Next or Continue to move through actionable subitems.',
        'Mark Complete only when the subitem is genuinely done.',
        'Use Skip or Report Issue with a clear reason when the work cannot be completed normally.',
      ],
      safety:
        'If any subitem is reported as failed, SentinelOps requires a final verdict before the main item can be completed.',
      visual: 'subitems',
    },
    {
      step: '08',
      title: 'Complete clean work cleanly',
      location: 'Item Actions or Smart Subitem completion step',
      actionLabel: 'Click Mark Complete',
      body:
        'Use Mark Complete when the item or subitem has been performed and no exception remains. Add completion notes when evidence, timing, or a decision would help review.',
      checklist: [
        'Confirm the action was actually performed.',
        'Add concise completion evidence when needed.',
        'For items with subitems, complete all subitems before completing the main item.',
      ],
      safety:
        'A completed item should not hide skipped, failed, or unresolved work. Use the exception path when the truth is messier.',
      visual: 'itemActions',
    },
    {
      step: '09',
      title: 'Skip only when it is valid to skip',
      location: 'Item Actions or subitem reason modal',
      actionLabel: 'Click Skip Item or Skip',
      body:
        'Skip when the step is not applicable, cannot be performed because a required condition is absent, or is deliberately deferred by the operating process. Skipping still needs a reason.',
      checklist: [
        'Choose Skip only after deciding the step should not be completed now.',
        'Write the reason in plain language.',
        'If the skipped work still matters later, add a handover note or create a task.',
      ],
      safety:
        'Skipping is not the same as resolving. It is an exception record. Use Task Center when follow-up must survive the shift.',
      visual: 'itemActions',
    },
    {
      step: '10',
      title: 'Report issues instead of hiding failure',
      location: 'Item Actions or subitem reason modal',
      actionLabel: 'Click Report Issue',
      body:
        'Report Issue when execution failed, evidence shows a real problem, the action is unsafe, or the result needs escalation. Describe the issue so the next person can act without guessing.',
      checklist: [
        'State what failed or what symptom was observed.',
        'Include evidence, system names, timestamps, or impact where possible.',
        'After investigation, use Resolve & Complete or add the required final verdict when the item can be closed.',
      ],
      safety:
        'Do not convert a failure into a skip just to finish faster. Reported issues are the trail supervisors and the next shift need.',
      visual: 'subitems',
    },
    {
      step: '11',
      title: 'Write manual handover while context is fresh',
      location: 'Handover Notes panel and Create Handover Note modal',
      actionLabel: 'Click Add Handover Note',
      body:
        'Manual handover notes are for unresolved items, risks, dependencies, evidence pointers, or decisions the next shift must understand immediately.',
      checklist: [
        'Click Add Handover Note.',
        'Choose a priority that matches operational urgency.',
        'Write what happened, what still matters, and what should happen next.',
      ],
      safety:
        'Use handover for shift context. Use Task Center when the work needs a named owner, due date, or multi-day follow-through.',
      visual: 'handover',
    },
    {
      step: '12',
      title: 'Promote long-tail work into Task Center',
      location: 'Task Center',
      actionLabel: 'Create or update a task',
      body:
        'When a checklist item becomes a responsibility beyond the current run, put it in Task Center. That gives it ownership, status, due date, and history.',
      checklist: [
        'Open the correct task lane: personal, assigned, team, overdue, or completed.',
        'Create or update the task with owner, due date, and enough context.',
        'Reference the checklist item or handover note so the trail stays connected.',
      ],
      safety:
        'Do not leave durable work only in a handover note. Handover explains; Task Center owns.',
      visual: 'taskCenter',
    },
    {
      step: '13',
      title: 'Finalize the checklist honestly',
      location: 'Live Checklist header and Complete Checklist dialog',
      actionLabel: 'Click Complete Checklist',
      body:
        'Managers and admins complete the checklist from the header once work is actioned. SentinelOps calculates whether the final state is Completed or Completed With Exceptions.',
      checklist: [
        'Confirm every item is completed, skipped, failed, or otherwise actioned.',
        'Review exception count in the Complete Checklist dialog.',
        'Confirm Complete, then download the checklist PDF if a record is needed.',
      ],
      safety:
        'If exceptions exist, the checklist should close with exceptions. That is not failure; that is transparency.',
      visual: 'finalize',
    },
  ] as ManualJourneyStep[],
  decisionRules: [
    {
      title: 'Start Working',
      useWhen: 'You are actively taking responsibility for an item now.',
      doThis: 'Open the item actions, choose Start Working, and add a short note if context matters.',
      evidence: 'The item moves out of pending state and the participant record shows live engagement.',
    },
    {
      title: 'Mark Complete',
      useWhen: 'The work was performed and no exception remains.',
      doThis: 'Choose Mark Complete and add concise completion notes when evidence or timing matters.',
      evidence: 'The item or subitem shows Completed with completion metadata.',
    },
    {
      title: 'Skip Item',
      useWhen: 'The step is not applicable, blocked by a valid condition, or deliberately deferred.',
      doThis: 'Choose Skip Item, write the reason, then hand over or create a task if follow-up still matters.',
      evidence: 'The reason is visible on the record and the checklist can close with exceptions if needed.',
    },
    {
      title: 'Report Issue',
      useWhen: 'Something failed, is unsafe, is unclear, or needs escalation.',
      doThis: 'Choose Report Issue and describe the symptom, impact, evidence, and immediate next action.',
      evidence: 'The issue is retained as an exception and can require final verdict before closure.',
    },
    {
      title: 'Add Final Verdict',
      useWhen: 'An item had skipped or failed evidence but is now ready to be resolved and closed.',
      doThis: 'Summarize the outcome, what changed, and why the item can now be considered complete.',
      evidence: 'The final verdict appears beside the completed item for audit and handover review.',
    },
    {
      title: 'Add Handover Note',
      useWhen: 'The next shift needs context, warning, dependency, evidence, or a decision trail.',
      doThis: 'Choose priority, write the operational facts, and keep the note focused on what happens next.',
      evidence: 'Incoming and outgoing notes appear in the Handover Notes panel with priority and author.',
    },
  ] as ManualDecisionRule[],
  modules: [
    {
      title: 'Dashboard',
      route: '/',
      routeLabel: 'Open Dashboard',
      visual: 'dashboard',
      question: 'What is happening right now?',
      when: 'Use this as the first stop after login and whenever the operation feels noisy.',
      checklist: [
        'Read operational state and critical signals.',
        'Scan Shift Radar and handover summary.',
        'Open the live command thread or checklist that needs action.',
      ],
      avoid:
        'Avoid jumping into history first when the current day already has an active signal.',
    },
    {
      title: 'Checklist Timeline',
      route: '/checklists',
      routeLabel: 'Open Checklist Timeline',
      visual: 'timeline',
      question: 'Which run, date, shift, or pattern do I need to inspect?',
      when: 'Use this for history review, date filtering, status filtering, and pattern investigation.',
      checklist: [
        'Choose All Time, Week, Specific Day, or Date Range.',
        'Filter by shift and status.',
        'Open only the instance that matches your investigation.',
      ],
      avoid:
        'Avoid reading every checklist one by one. Filter until the timeline tells a narrow story.',
    },
    {
      title: 'Live Checklist',
      route: '/checklist/:id',
      routeLabel: 'Open from a live checklist card',
      visual: 'checklistHeader',
      question: 'What work must be executed and recorded now?',
      when: 'Use this as the source of truth for live shift execution.',
      checklist: [
        'Join when you are participating.',
        'Work items through Start, Complete, Skip, or Report Issue.',
        'Keep handover notes and team presence current.',
      ],
      avoid:
        'Avoid closing the checklist before every item is actioned and handover context is written.',
    },
    {
      title: 'Task Center',
      route: '/tasks',
      routeLabel: 'Open Task Center',
      visual: 'taskCenter',
      question: 'What needs accountable follow-up beyond this shift?',
      when: 'Use this when work needs an owner, due date, status trail, or cross-shift accountability.',
      checklist: [
        'Choose the correct lane before scanning.',
        'Open details before changing status.',
        'Promote unresolved checklist work into a task when it must survive the shift.',
      ],
      avoid:
        'Avoid using handover notes as a substitute for owned tasks.',
    },
    {
      title: 'Handover Notes',
      route: '/checklist/:id',
      routeLabel: 'Open inside a live checklist',
      visual: 'handover',
      question: 'What must the next operator know?',
      when: 'Use this before and during shift transition, or whenever a decision needs to be preserved.',
      checklist: [
        'Acknowledge incoming notes.',
        'Add outgoing notes with priority.',
        'Resolve or promote notes that become durable follow-up work.',
      ],
      avoid:
        'Avoid vague handover like checked later. Say what was checked, what remains, and what to do next.',
    },
    {
      title: 'Templates',
      route: '/templates',
      routeLabel: 'Open Templates',
      visual: 'templates',
      question: 'How do we make repeated work easier next time?',
      when: 'Use this when a process repeats often enough that operators should not rely on memory.',
      checklist: [
        'Start from the library.',
        'Order items the way work naturally happens.',
        'Review the operator-facing sequence before publishing.',
      ],
      avoid:
        'Avoid adding reminders in chat when the real fix is a clearer template.',
    },
    {
      title: 'Schedule and Team Management',
      route: '/team',
      routeLabel: 'Open Team Management',
      visual: 'schedule',
      question: 'Who covers what, and when?',
      when: 'Use this for coverage, patterns, leave, exceptions, and future roster pressure.',
      checklist: [
        'Choose the correct planning horizon.',
        'Read coverage before editing assignments.',
        'Use patterns for recurring structure and one-off edits for true exceptions.',
      ],
      avoid:
        'Avoid repeated manual assignment when a saved pattern would remove the friction.',
    },
    {
      title: 'Network Sentinel',
      route: '/network-sentinel',
      routeLabel: 'Open Network Sentinel',
      visual: 'network',
      question: 'Is this a real service or infrastructure signal?',
      when: 'Use this when you need service health, timeline evidence, retained events, or technical proof.',
      checklist: [
        'Scan the service board for degraded or down assets.',
        'Select the affected service.',
        'Read Signal, Timeline, and Evidence before taking action.',
      ],
      avoid:
        'Avoid judging only from the latest sample. Timeline and evidence can show what happened earlier.',
    },
    {
      title: 'TrustLink Operations',
      route: '/trustlink',
      routeLabel: 'Open TrustLink Ops',
      visual: 'trustlink',
      question: 'Where is the extraction or delivery run in its pipeline?',
      when: 'Use this for run readiness, pipeline stage failures, export availability, and delivery control.',
      checklist: [
        'Read run-state metrics first.',
        'Find the stage where movement stopped or completed.',
        'Download, overwrite, or delete only after the evidence panel agrees.',
      ],
      avoid:
        'Avoid control actions before checking the pipeline timeline and current file state.',
    },
  ] as ManualModule[],
  closeoutChecklist: [
    'All checklist items are completed, skipped, failed, or otherwise actioned.',
    'Skipped items have reasons that a reviewer can understand.',
    'Reported issues include symptoms, impact, and evidence pointers.',
    'Failed subitems have final verdicts before the main item is closed.',
    'Manual handover notes exist for unresolved risk, dependencies, or next-shift action.',
    'Durable follow-up work is captured in Task Center with an owner and due date.',
    'The Complete Checklist dialog outcome matches the real execution record.',
    'The checklist PDF is downloaded only after the checklist is closed.',
  ],
  habits: [
    {
      title: 'Write for the person who was not in the room',
      body:
        'A good note says what happened, what changed, what still matters, and what should happen next.',
    },
    {
      title: 'Use the narrowest workspace that can solve the question',
      body:
        'Dashboard for posture, checklist for live execution, Task Center for owned follow-up, schedule for coverage, and technical decks for evidence.',
    },
    {
      title: 'Treat exceptions as transparency, not embarrassment',
      body:
        'Skipped and failed work can be handled professionally. The danger is hiding it from the record.',
    },
    {
      title: 'Fix repeated confusion at the system level',
      body:
        'If the same question keeps coming back, improve the template, task flow, access placement, or schedule pattern.',
    },
  ] as ManualHabit[],
};
