export const SECTION_MANUAL_ID = '7bd4144d-68d8-4ac3-897d-245941612daf';

export interface ManualPrinciple {
  title: string;
  body: string;
}

export interface ManualLoop {
  title: string;
  summary: string;
  steps: string[];
  outcome: string;
}

export interface ManualModule {
  title: string;
  route: string;
  routeLabel: string;
  when: string;
  why: string;
  steps: string[];
  shortcut: string;
  watchFor: string;
  permissions: string;
}

export interface ManualShortcut {
  title: string;
  body: string;
}

export interface ManualHabit {
  title: string;
  body: string;
}

export const sentinelManual = {
  eyebrow: 'Section Field Manual',
  title: 'SentinelOps Operator Playbook',
  intro:
    'This manual is written for the SentinelOps crews working under section 7bd4144d-68d8-4ac3-897d-245941612daf. It is not a screen tour. It is the fastest way to understand where to start, how to move through the system, and which habits keep operations clean, auditable, and easy to hand over.',
  openingSequence: [
    'Read posture first on Dashboard before you touch live work.',
    'Open the command thread or checklist that owns the issue instead of chasing information across pages.',
    'Use Task Center for work that must survive the shift, and use checklists for work that must be executed now.',
    'Capture handover notes, exceptions, and evidence where the next operator will actually look for them.',
  ],
  principles: [
    {
      title: 'Start with posture, not guesswork',
      body:
        'Dashboard is the command lens. Before you open a queue, read the day: posture, exceptions, critical containment, coverage gaps, and which command thread is carrying the operational heat.',
    },
    {
      title: 'Work inside the source of truth',
      body:
        'If the work is happening now, it belongs in the live checklist. If it needs ownership and follow-through beyond a shift, it belongs in Task Center. If it changes staffing, it belongs in the schedule workspace.',
    },
    {
      title: 'Promote signal into evidence fast',
      body:
        'Network Sentinel and TrustLink are not there for decoration. Use them when you need proof, timelines, retained events, or the exact stage where a run went wrong.',
    },
    {
      title: 'Prefer repeatable structure over memory',
      body:
        'Templates, shift patterns, and saved operating flows are the force multipliers in this app. When a routine repeats, improve the structure once instead of fixing it manually every day.',
    },
  ] as ManualPrinciple[],
  loops: [
    {
      title: 'Start-of-shift loop',
      summary:
        'Use this loop when you are coming on duty and need a fast, reliable operational picture before touching live work.',
      steps: [
        'Open Dashboard and read command posture, critical containment, and coverage gaps first.',
        'Open the command thread that matches your shift or the area showing pressure.',
        'Join the live checklist if you are participating, then read the latest handover notes before executing anything.',
        'Open Schedule only if your own coverage or the next handoff is unclear.',
      ],
      outcome:
        'You begin with context, not assumptions, and you avoid duplicating work the previous operator already captured.',
    },
    {
      title: 'Mid-shift triage loop',
      summary:
        'Use this when the operation feels noisy and you need to separate symptoms from the real next action.',
      steps: [
        'Return to Dashboard to confirm whether the issue is execution pressure, a coverage gap, or a system signal.',
        'Move into the live checklist if the problem is blocked execution or an unresolved exception.',
        'Move into Task Center if the issue needs explicit ownership, a due date, or cross-shift follow-up.',
        'Move into Network Sentinel or TrustLink if the problem needs technical evidence, timeline review, or run-stage analysis.',
      ],
      outcome:
        'You spend less time bouncing between pages and more time inside the workspace that can actually resolve the issue.',
    },
    {
      title: 'Manager planning loop',
      summary:
        'Use this when you are shaping future coverage, handling leave, or cleaning up who owns what.',
      steps: [
        'Open Team Management and choose the right horizon before making any schedule edits.',
        'Read the current coverage picture first so you know whether this is a pattern problem or a one-off exception.',
        'Use saved patterns for repeatable structures and single assignments or time off for the dates that need judgment.',
        'Open User Management only after the staffing shape is clear and you need to fix the people, roles, or access behind it.',
      ],
      outcome:
        'You protect the schedule from ad-hoc drift and keep people structure aligned with the real plan.',
    },
    {
      title: 'End-of-shift handover loop',
      summary:
        'Use this before you leave so the next operator inherits a clean board instead of a puzzle.',
      steps: [
        'Finish or update checklist items where the work actually progressed.',
        'Write handover notes for what is unresolved, risky, or dependent on the next shift.',
        'Move unfinished long-tail work into Task Center if it must remain owned beyond the checklist run.',
        'Check your personal schedule if the next assignment, recovery day, or deadline needs confirmation.',
      ],
      outcome:
        'The next shift can continue the operation immediately without recreating context from memory.',
    },
  ] as ManualLoop[],
  modules: [
    {
      title: 'Dashboard',
      route: '/',
      routeLabel: 'Open Dashboard',
      when:
        'Use Dashboard whenever you need the quickest answer to “What kind of day are we having?” or “Where should I intervene first?”',
      why:
        'It compresses the operational day into posture, shift pressure, active command threads, attention signals, and handover context. It is the shortest path from uncertainty to direction.',
      steps: [
        'Read command posture and containment first. Those tell you whether the day is calm, unstable, or slipping.',
        'Scan Shift Radar next so you can see whether pressure belongs to one shift or the whole board.',
        'Open the relevant command thread card once you know where the heat is. That is the handoff into execution detail.',
      ],
      shortcut:
        'Do not start in checklist history when you are troubleshooting the current day. Dashboard already tells you which live thread deserves your attention.',
      watchFor:
        'Coverage gaps and pending review counts are often early warnings that the day looks stable on the surface but is quietly starting to drift.',
      permissions:
        'All authenticated users rely on this page, but managers and admins should treat it as the opening move for supervision.',
    },
    {
      title: 'Operational Day Checklists',
      route: '/checklists',
      routeLabel: 'Open Checklist Timeline',
      when:
        'Use Checklists when you need to trace what happened across time, compare runs, or move from broad history into one exact instance.',
      why:
        'This page turns checklist history into a readable timeline instead of a flat archive. It is best when you know the date, shift, or status pattern you want to inspect.',
      steps: [
        'Set the time window first. Day view is for a known incident. Week and custom range are for pattern reading.',
        'Apply search, shift, or status filters until the history tells a narrower story.',
        'Open the checklist instance you care about only after the timeline is clean enough to explain itself.',
      ],
      shortcut:
        'If you are analyzing a single live issue, skip this page and jump straight from Dashboard into the active command thread instead.',
      watchFor:
        'Week and range views are where repeat failures, repeated exceptions, and weak handovers become obvious.',
      permissions:
        'Operators use it to review runs; leaders use it to compare operational quality over time.',
    },
    {
      title: 'Live Checklist Workspace',
      route: '/checklist/:id',
      routeLabel: 'Open Active Checklist',
      when:
        'Use the live checklist when the work is happening right now and every action, note, and exception needs to stay attached to the shift record.',
      why:
        'This is the execution source of truth. It keeps items, substeps, participation, progress, and handover together so the team can trust the record after the fact.',
      steps: [
        'Join the checklist when you are actively working inside the shift so presence stays accurate.',
        'Work item by item. Open substeps when the detail matters more than speed.',
        'Capture handover notes before you leave the page, especially when the next operator would otherwise need verbal reconstruction.',
      ],
      shortcut:
        'If a task belongs to the shift only, keep it in the checklist. Promote it to Task Center only when it needs formal ownership beyond the run.',
      watchFor:
        'Unwritten exceptions are invisible debt. If the checklist does not show it, the next shift cannot act on it confidently.',
      permissions:
        'This is the primary operator workspace and the main supervision record during live execution.',
    },
    {
      title: 'Task Center',
      route: '/tasks',
      routeLabel: 'Open Task Center',
      when:
        'Use Task Center when the work needs a durable owner, due date, history trail, or follow-through outside the life of a single checklist.',
      why:
        'Task Center protects important work from vanishing at shift boundary. It is where operational loose ends become accountable work with visibility.',
      steps: [
        'Choose the right lane first so you are reading the right queue: personal, assigned, overdue, team, or completed.',
        'Filter until the task list is actually saying something useful instead of forcing you to scan noise.',
        'Open the detail view before changing status so you understand the task history, urgency, and previous movement.',
      ],
      shortcut:
        'When a checklist item becomes a multi-day responsibility, create or update the task immediately instead of relying on handover notes alone.',
      watchFor:
        'An overloaded overdue lane usually means the team is using checklists to discover work but not promoting the long-tail follow-up into owned tasks.',
      permissions:
        'Useful to all roles, but especially important for managers coordinating follow-up across multiple shifts.',
    },
    {
      title: 'TrustLink Operations',
      route: '/trustlink',
      routeLabel: 'Open TrustLink Ops',
      when:
        'Use TrustLink when you need to understand extraction pipeline state, run readiness, failure stage, or whether the output is safe to deliver.',
      why:
        'The page keeps technical pipeline detail readable. It shows what stage the run is in, what succeeded, what stalled, and whether the export can be acted on.',
      steps: [
        'Read the run-state metrics first to understand whether today is active, complete, or blocked.',
        'Use the pipeline timeline to find the exact stage where movement stopped or succeeded.',
        'Open the run detail and history only after you know which run or failure pattern you are investigating.',
      ],
      shortcut:
        'When a run fails, the timeline usually explains the failure faster than the history list alone. Start there.',
      watchFor:
        'Do not download, overwrite, or delete files before the state and evidence panel agree that the run is complete and the output is the one you actually want.',
      permissions:
        'Best used by operators and leads who own pipeline visibility, delivery readiness, or failure response.',
    },
    {
      title: 'Network Sentinel',
      route: '/network-sentinel',
      routeLabel: 'Open Network Sentinel',
      when:
        'Use Network Sentinel when the question is about infrastructure state, service degradation, outage proof, or retained evidence around a technical event.',
      why:
        'It separates detection from diagnosis. The left side tells you what is sick. The right side tells you why it matters and what the timeline says happened.',
      steps: [
        'Scan the fleet view for assets marked degraded or down before opening deep detail.',
        'Select the affected service and start in Signal, then move into Timeline and Evidence once the behavior is clear.',
        'Use filters only after you understand whether you are narrowing by environment, status, or ownership.',
      ],
      shortcut:
        'Treat the service grid as the radar sweep and the right-side deck as the evidence room. Keeping that discipline makes investigation much faster.',
      watchFor:
        'A service that looks stable now may still show an important event sequence in Timeline or retained Evidence. Do not judge only from the latest sample.',
      permissions:
        'Most valuable to teams diagnosing systems and proving what changed during an incident.',
    },
    {
      title: 'Template Manager',
      route: '/templates',
      routeLabel: 'Open Templates',
      when:
        'Use Templates whenever the team repeats a process often enough that memory, chat, or informal routines are no longer good enough.',
      why:
        'Templates decide how future checklist runs feel under pressure. A clean template removes hesitation, reduces skipped work, and makes handover more consistent.',
      steps: [
        'Start in the library and decide whether this should be a new template, an edited template, or a reused one.',
        'Structure the item order the way the work naturally happens on shift, not the way it was discussed in a meeting.',
        'Review the operator-facing result before publishing so the live run feels obvious the first time someone opens it.',
      ],
      shortcut:
        'If operators keep improvising the same extra step, the fix is usually a better template, not a reminder in chat.',
      watchFor:
        'A template that looks complete but feels confusing in sequence will fail in the field. Order matters as much as content.',
      permissions:
        'Mostly a manager and admin space, but operators should feed back what makes execution smoother or heavier.',
    },
    {
      title: 'Schedule and Team Management',
      route: '/team',
      routeLabel: 'Open Team Management',
      when:
        'Use Team Management when the question is about coverage, repeatable schedules, exceptions, leave, staffing patterns, or upcoming planning strain.',
      why:
        'It is the planning deck for future coverage. Patterns create speed, single assignments create precision, and horizon controls stop managers from planning blind.',
      steps: [
        'Choose the right horizon before editing anything so you are solving the correct window.',
        'Read the existing coverage summary first. Do not start assigning people until you understand whether the board is balanced or already strained.',
        'Use patterns for recurring structure and reserve one-off edits for genuine exceptions.',
      ],
      shortcut:
        'If you are making the same manual assignment more than once, stop and ask whether it should be a saved pattern instead.',
      watchFor:
        'Heavy exception editing is often a sign that the base pattern is wrong, not that the week is unusually messy.',
      permissions:
        'Primarily for managers and admins. Operators usually consume the result through their personal schedule.',
    },
    {
      title: 'User Management',
      route: '/users',
      routeLabel: 'Open User Management',
      when:
        'Use User Management when access, roles, department placement, section placement, or account activation needs to change.',
      why:
        'This is the identity control room. Clean access structure protects the operation from confusion, over-permission, and misrouted ownership.',
      steps: [
        'Find the user first and review their current role, department, section, and active state before changing anything.',
        'Change only the fields that reflect real responsibility. Do not use role changes as a shortcut for process issues.',
        'Create new accounts with the correct placement from the start so the user lands in the right operational context immediately.',
      ],
      shortcut:
        'Fixing access at the source is faster than working around a misconfigured user everywhere else in the app.',
      watchFor:
        'Bad section placement quietly breaks schedule, team, and ownership workflows even when the account can still log in.',
      permissions:
        'Admin-focused. Managers should usually escalate placement or role changes rather than improvising them outside this flow.',
    },
    {
      title: 'Personal Schedule and Performance',
      route: '/schedule',
      routeLabel: 'Open My Schedule',
      when:
        'Use your personal schedule when you need to verify upcoming duty, recovery windows, open days, or task deadlines tied to your calendar.',
      why:
        'It keeps your operational life readable at a glance. You can confirm what is next, what is due, and where your own workload starts to bunch up.',
      steps: [
        'Read the summary and your next assignment first so immediate expectations are obvious.',
        'Switch between month and week based on whether you are planning ahead or managing the next few days.',
        'Open specific dates when you need exact timing, deadline context, or to confirm that a day is still open.',
      ],
      shortcut:
        'Check this page before asking whether you are covered, off, or due for work. It is faster than piecing the answer together from multiple places.',
      watchFor:
        'Open days are not automatically errors. They only become a problem when they conflict with expected coverage or task ownership.',
      permissions:
        'Every user should use this page. It is the cleanest view of your own near-term operational rhythm.',
    },
  ] as ManualModule[],
  shortcuts: [
    {
      title: 'Dashboard to action',
      body:
        'When the board looks wrong, open the command thread card from Dashboard instead of browsing checklist history. That is the shortest route from signal into the live source of truth.',
    },
    {
      title: 'Checklist to accountability',
      body:
        'If an unresolved checklist item will survive the shift, move it into Task Center before handover. That prevents operational debt from dissolving into memory.',
    },
    {
      title: 'Pattern before manual assignment',
      body:
        'If the same staffing layout keeps coming back, create or fix the pattern. Manual scheduling should be the exception, not the operating model.',
    },
    {
      title: 'Timeline before control action',
      body:
        'In TrustLink and Network Sentinel, read the timeline and evidence before you refresh, rerun, overwrite, or delete anything. Evidence first, action second.',
    },
    {
      title: 'Template before reminder',
      body:
        'When a team repeatedly forgets a step, the durable fix is almost always a better template rather than another reminder message.',
    },
    {
      title: 'Identity cleanup before workaround',
      body:
        'If a user cannot see the right team, schedule, or responsibility lane, fix their role or section placement instead of teaching a workaround.',
    },
  ] as ManualShortcut[],
  habits: [
    {
      title: 'Leave a cleaner board than the one you inherited',
      body:
        'Update statuses, close what is truly done, and capture handover context before you move on. SentinelOps gets stronger when every shift reduces ambiguity.',
    },
    {
      title: 'Do not hide operational debt inside chat',
      body:
        'If work needs ownership, put it in the task or checklist system. Chat is fine for coordination, but it is a weak memory system.',
    },
    {
      title: 'Use the narrowest page that can answer the question',
      body:
        'Dashboard for posture, checklist for live execution, Task Center for follow-through, Team Management for coverage, and technical decks for evidence.',
    },
    {
      title: 'Write for the next operator, not for yourself',
      body:
        'The best notes explain what changed, what still matters, and what should happen next. Assume the next reader was not in the room.',
    },
    {
      title: 'Treat role boundaries as safety rails',
      body:
        'Admins shape access, managers shape coverage and templates, and operators shape execution truth. Respecting those lanes keeps the system coherent.',
    },
    {
      title: 'Fix the system when the same friction repeats',
      body:
        'Recurring confusion is a design signal. Improve the template, task flow, pattern, or placement so the next shift moves faster with less effort.',
    },
  ] as ManualHabit[],
};
