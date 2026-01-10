# SmartHR

<img width="1366" height="768" alt="dashboard" src="https://github.com/user-attachments/assets/51b9cb02-dd4e-46fb-81ea-e32718c193f4" />

SmartHR isn’t your run-of-the-mill HR platform, it’s a futuristic, human-centric HR operating system designed to do more than just “manage” employees. It empowers them. It connects teams. It simplifies the chaos.

I built SmartHR with one clear goal, to let humans do the human work, and let SmartHR handle the rest.

With a tech stack that means business: React (TypeScript) on the frontend, Express + TypeScript + MSSQL on the backend, I’ve designed a system that’s clean, fast, modular, and built to scale.

## System Modules & Features

### Authentication & User Management

<img width="1366" height="768" alt="signing" src="https://github.com/user-attachments/assets/ea624330-428c-47cc-97d0-0e3e8ce3dcc4" />

- Secure JWT-based login & signup.
- Role-aware (admin/manager vs employee-ready).
- Profile updates & password reset via secure endpoints.
- Persistent sessions managed via `useAuth` context and token interceptors.

## Performance Intelligence Modules

### ReviewRadar:

<img width="1366" height="768" alt="performancehub-feedbackradar" src="https://github.com/user-attachments/assets/71665c15-0954-4cf1-9495-a44face7ee73" />

ReviewRadar is a visual, skill-centric performance graph that compares an employee’s current skill competency against their target levels using a Spider Radar chart that transforms complex performance data into a sleek, digestible visual
It helps employees and managers quickly identify strengths, gaps and development priorities.
  
## ImpactReceipts:
- 
<img width="1366" height="768" alt="impactreceipts" src="https://github.com/user-attachments/assets/fdd8e27d-5744-46c0-8b82-5de2871e42b0" />

The ImpactReceipt is a categorized visual performance breakdown that summarizes an employee’s key contributions and their measurable effect across core impact areas like innovation, collaboration, productivity, leadership and general for skills earned and feedback. It works like a receipt of value delivered  that logs what an employee did and how much it mattered.

## GrowthStream:

<img width="1366" height="768" alt="growthstream" src="https://github.com/user-attachments/assets/1b83a551-9c5f-4a01-9610-2ec956a46a60" />

real-time performance feed that captures and displays an employee’s growth-related activities in one continuous, organized stream. It includes feedback, achievements, and skill progress all in one place. Think of it as the "activity log of professional development." A living timeline that showcases how an employee is growing over time.

## Harmony Scheduler (Leave Management)

<img width="1366" height="768" alt="leaveSubmitted" src="https://github.com/user-attachments/assets/9a5adc88-25a5-4174-b1ca-112316708bc5" />

HarmonyScheduler is SmartHR’s intelligent leave planning tool that lets employees schedule time off while minimizing disruption to their teams. It balances personal time with team continuity by using team calendar visibility peer coverage suggestions and leave impact prediction. It’s a context aware scheduler that brings harmony to HR operations.

## BridgeBuilder (Collaboration Engine)

<img width="1366" height="768" alt="bridgebuilder_collaboration-engine" src="https://github.com/user-attachments/assets/1ef4f95e-8abd-4e56-8ab8-cc58db6cda99" />

Traditional HR Problem: Employees stay siloed.
Smart Solution: SmartHR analyzes departments and skills to suggest peer-to-peer introductions.
Logic:
- Finds pairs from the same department who haven’t collaborated.
- Prioritizes shared skills, filters out past collabs or shared projects.
- Suggests intros with a “collaboration strength” score.

## TeamClimate Tracker

<img width="1366" height="768" alt="teamClimate" src="https://github.com/user-attachments/assets/424ed747-310d-4cc8-9dfd-f0db47ec916e" />

What it does:
- Daily mood check-ins: with emojis
- Aggregated weekly to help HR see morale trends.
- Backend tracks and limits one submission per day.

## TimeCapsule 

<img width="1366" height="768" alt="timecapsule" src="https://github.com/user-attachments/assets/afb2833a-f6db-4e7d-b471-88fbaa5058bd" />

The SmartHR TimeCapsule is a reflective, narrative-based performance feature that captures and preserves key milestones, achievements, feedback, and growth insights of each employee over time. Like a personalized digital journal that grows with you.
Rather than just quantitative reviews, the TimeCapsule proves to psychologically increase ownership of growth, build self-awareness, and boost confidence and motivation cause who doesnt feel confident and motivated by their own achievements. It enhances work spirit by use of a timeline of skill updates, feedback and personal wins.

## TeamCalendar 

<img width="1366" height="768" alt="teamcalendar" src="https://github.com/user-attachments/assets/82aa8b9e-f1be-4120-8a20-5eb46c87aee1" />

The TeamCalendar is a visual, shared calendar that displays upcoming and ongoing employee leaves across the organization or department. 
It gives a real-time overview of who’s on leave, when, and for what reason, making team planning smooth and transparent.

## Tech Stack

- Frontend: React, Tailwind, Chart.js
- Backend: Node.js, Express, MSSQL
- Auth: JWT

## Conclusion

SmartHR isn’t just a system, it’s a shift in how we think about work, people and potential.
In an era where talent is the true engine of growth, SmartHR serves as the mission control. It tracks performance, promotes collaboration, maps leave impact and even checks the team’s emotional pulse, all while staying humane at its core.This platform doesn’t drown you in dashboards or bury insights in spreadsheets, it surfaces what matters, when it matters. With time it can learn, evolve and scale with your team.
Built with modern technologies and a vision that dares to challenge traditional HR software, SmartHR is for teams that want more than management, that want momentum.

Welcome to HR reimagined.
Welcome to SmartHR...
