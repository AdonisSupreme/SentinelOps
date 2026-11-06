import type { PageGuideDefinition } from '../components/ui/PageGuide';
import { guideGroups, operatorGuides } from './operatorGuides';
export const NEXUS_MANUAL_PDF_PATH = '/manual/Sentinel_Nexus_Operator_Manual.pdf';
export const FUNDS_CUSTODY_MANUAL_PDF_PATH = '/manual/SentinelOps_Funds_Custody_Operating_Guide.pdf';
export const pageGuides: Record<string, PageGuideDefinition> = {
  "dashboard": {
    "eyebrow": "Command Guide",
    "title": "Reading the operational command deck",
    "intro": "The dashboard is the lightest way to understand the current operational day. It pulls the live command picture into one deck so you can see posture, pressure, and action paths without hunting across multiple pages.",
    "sections": [
      {
        "title": "Operational State",
        "body": "The hero metrics show readiness, execution, containment, and staffing so you can judge the day in seconds."
      },
      {
        "title": "Funds Movement",
        "body": "Compact indicators show decisions awaiting authorization, hovering queue status, pending work, throughput, and the robot window. Open each workspace for its full detail."
      },
      {
        "title": "Command Threads",
        "body": "These cards represent today's active checklist threads. Open one when you need item-level progress, exceptions, or participant context."
      },
      {
        "title": "Matrix and Actions",
        "body": "Use the matrix, attention queue, handover summary, and quick actions to move from awareness into the next operational step."
      }
    ],
    "workflow": [
      "Start with Operational State to understand the day's overall posture.",
      "Read Custody + automation for waiting approvals and the current loan-hovering state. A disconnected source is explicitly marked unavailable.",
      "Open Execution Desk when checker custody is waiting, or Hovering Monitor when robot movement stalls or overdue dates accumulate.",
      "Open the right command thread or use a quick action once you know where intervention is needed."
    ],
    "tip": "This page is for command awareness. Once the issue is clear, shift into the checklist, task, or monitoring workspace to act with detail."
  },
  "userManagement": {
    "eyebrow": "Access Guide",
    "title": "Managing people and access",
    "intro": "User Management is the identity control room for SentinelOps. It is where administrators shape who can enter the platform, where they belong, and what level of responsibility they carry.",
    "sections": [
      {
        "title": "User Directory",
        "body": "The directory lets you search people quickly by name, username, or email before moving into account work."
      },
      {
        "title": "Profile Console",
        "body": "Selecting a user opens their editable identity record, including role, department, section, active state, and password controls."
      },
      {
        "title": "Create User Flow",
        "body": "New accounts are created here with the person's core identity, organizational placement, and initial access setup."
      },
      {
        "title": "Role and Placement",
        "body": "Roles shape platform authority, while department and section placement determine where users belong operationally."
      }
    ],
    "workflow": [
      "Find the person you need to manage in the directory.",
      "Review their current role, location, and account status before making changes.",
      "Save updates or create a new account when a new operator joins the organization."
    ],
    "tip": "Keep access aligned to real responsibility. Clean identity structure makes every other SentinelOps workflow safer and easier to understand."
  },
  "login": {
    "eyebrow": "Access Guide",
    "title": "Signing in to SentinelOps",
    "intro": "The login page is the entry gate into SentinelOps. It now adapts to the authentication mode in front of you so people can tell whether they are signing in with Active Directory or SentinelOps credentials.",
    "sections": [
      {
        "title": "Identity Mode",
        "body": "The form explains whether you should use your Windows credentials or your SentinelOps account details for this environment."
      },
      {
        "title": "Directory Status",
        "body": "The Active Directory status panel shows whether directory-backed authentication is currently reachable and healthy."
      },
      {
        "title": "Sign-In Result",
        "body": "Successful login opens the parts of SentinelOps your role allows, from dashboards and checklists to management pages."
      },
      {
        "title": "Failure Signals",
        "body": "If sign-in fails, the page helps distinguish bad credentials from a server, directory, or connectivity issue."
      }
    ],
    "workflow": [
      "Check the sign-in hint so you know which credentials this environment expects.",
      "Review the directory status if the page is using Active Directory.",
      "Submit your credentials and follow the returned error signals if access is denied."
    ],
    "tip": "When the page points to directory or connectivity trouble, the problem may be infrastructure rather than your credentials."
  },
  "notFound": {
    "eyebrow": "Navigation Guide",
    "title": "Recovering from a dead route",
    "intro": "This page appears when SentinelOps cannot resolve the address you tried to open. Usually the route is outdated, incomplete, or no longer belongs to the current application state.",
    "sections": [
      {
        "title": "Missing Destination",
        "body": "The requested location does not exist at the current address."
      },
      {
        "title": "Safe Return Path",
        "body": "The primary action takes you back to a known working area so you can re-enter the platform cleanly."
      },
      {
        "title": "Broken Link Signal",
        "body": "If you arrived here from inside SentinelOps, the original link or route probably needs updating."
      },
      {
        "title": "No Data Loss",
        "body": "This is only a navigation dead end. It does not mean your account, shift, or records have disappeared."
      }
    ],
    "workflow": [
      "Use the return action to get back to a known working page.",
      "Navigate again from the main menu, dashboard, or another trusted starting point.",
      "Report the route if the same broken path keeps sending you back here."
    ],
    "tip": "A not-found page usually means the address is wrong, not that the underlying SentinelOps data is gone."
  }
};
Object.entries(guideGroups).forEach(([key,moduleKeys]) => {
 const guides=operatorGuides.filter(guide=>moduleKeys.includes(guide.key));
 const first=guides[0];
 pageGuides[key]={moduleKeys,title:first.title,eyebrow:'Operator companion',intro:first.summary,sections:[],workflow:first.tasks[0].steps.map(step=>step.body),tip:first.tasks[0].stop};
});
