# OSWMS Full System Flow

## Overview
OSWMS is a sports week management system with support for:
- Game/event creation and approval workflows
- Team registration, join requests, and committee verification
- Match scheduling, fixture generation, and live scoring
- Volunteer shift assignment, QR-based attendance, and payout staging
- Admin dashboards, notifications, complaints, leaderboards, and public announcements
- Flexible entity lookup for games, teams, volunteers, and venues

## Key Roles

### Major Admin
- Access `/admin`
- Create games and configure active events
- Assign students to game committees
- Generate fixtures for round robin or knockout formats
- Publish live match scores and advance brackets
- Resolve schedule conflicts
- Broadcast announcements
- Manage volunteers and payment rates
- Review SWECAD approval requests

> Note: The system uses the role `Major_Admin` internally. The login page may label this account as “Admin,” but it is the Major Admin account.

## Login Credentials for All User Types

The login page accepts the same basic fields for every user: username and password.

### Login logic
- The system first checks whether the entered username and password match the default Major Admin credentials.
- If they match, the system logs in the user as a Major Admin.
- If not, it checks the registered user table and verifies the username/email and password.
- If the credentials are correct, the user is logged in according to their role such as Student, Committee Member, or Major Admin.
- If the credentials are wrong, the system shows an invalid credentials message.

### 1. Major Admin / System Admin
- Default login credentials:
  - Username: `admin`
  - Password: `admin123`
- These values can be changed by setting environment variables `AUTH_USER` and `AUTH_PASSWORD`.
- If no Major Admin account exists in the database, the system creates one automatically on first login.

### 2. Committee Member
- A committee member is not created by a special separate login.
- First, a student account must be registered.
- Then the Major Admin promotes that student to a Committee Member and assigns them to a game.
- After that, the committee member logs in using the same login form with their own username/email and password.

### 3. Student / Participant
- Students register through the signup page.
- During signup they choose:
  - username
  - email
  - password
  - full name
  - optional class/phone details
- After registration, they use that username/email and password to log in.

### 4. Other users
- There is no separate guest or visitor login role in this system.
- Normal users must either register as a student or be created/assigned by the Major Admin.

> In short: Major Admin has a default login, while students and committee members use their own registered account credentials.

### Committee Member
- Access `/committee`
- Manage the assigned game only
- Edit rules and regulations
- Verify teams for competition entry
- Schedule and reschedule matches
- Publish live scores for matches in the assigned game
- Replace opponents or flip match sides
- Assign volunteer shifts for the assigned game

### Student / Participant
- Sign up and log in via `/signup` or `/login`
- Browse teams on `/teams`
- Create a team for a game or request to join an existing team
- Register individual participants (via registration components)
- Submit event approval requests through `/approvals`
- View dashboard alerts, scores, and team updates

## New / Enhanced Feature Modules

### Approval workflow (`SWECAD`)
- Backend: `backend/src/routes/approvals.js`
- Frontend: `frontend/src/pages/Approvals.js`
- Flow:
  1. Student submits approval request with `game_id` and notes
  2. API stores request in `event_approvals`
  3. Game `approval_status` is set to `pending_review`
  4. Major Admin reviews via `/approvals`
  5. Approved or rejected status updates both `event_approvals` and `games`
- Supports descriptive lookup for game references via `resolveEntityId`

### Volunteer management
- Backend: `backend/src/routes/volunteers.js`
- Frontend: `frontend/src/pages/VolunteerManagement.js`
- Flow:
  1. Admin/committee creates volunteer profiles
  2. Admin/committee assigns volunteer shifts to a game and optional venue
  3. A QR token is generated and stored in `volunteer_shifts.qr_code`
  4. Attendance is recorded via `POST /api/volunteers/shifts/:id/scan`
  5. Attendance ledger is exposed by `GET /api/volunteers/attendance`
- Note: Current UI does not render a visual QR image or scanner; scan flow is token-based

### Payments and payouts
- Backend: `backend/src/routes/payments.js`
- Frontend: `frontend/src/pages/Payments.js`
- Flow:
  1. Admin configures payment rates in `payment_rates`
  2. Admin calculates payouts for a game using completed matches and completed shifts
  3. The system builds a preview list of payment rows
  4. Admin stages payments with `POST /api/payments/stage`
  5. Staged payment records are stored in `payments`
- Calculations may use completed match officials and completed volunteer shifts

### Flexible lookup helper
- `backend/src/utils/resolveEntityId.js`
- Allows backend routes to accept either numeric IDs or descriptive text
- Supported lookup across: `games`, `teams`, `volunteers`, `venues`
- Used in: approvals, volunteers, payments, teams, participants

### Inline feedback & schedule/status visuals
- Frontend: `frontend/src/components/ui/InlineMessage.js`, `frontend/src/components/ui/MatchStatusBadge.js`, `frontend/src/pages/Schedule.js`, `frontend/src/index.css`
- Purpose: provide immediate, localized confirmation messages next to action buttons (publish score, update schedule, swap opponent, create game, broadcast, assign committee) so users do not need to scroll to a global banner to confirm changes.
- Match status visuals: `MatchStatusBadge` and `.oswms-match-card--*` styles were strengthened to make live, scheduled and completed matches more visible at-a-glance. `Schedule.js` was refactored to group live/upcoming/completed matches and to poll live matches more frequently.

## Important API and UI Mappings

### Admin UI links added
- `frontend/src/components/Navbar.js`
  - `/approvals` visible to logged-in users
  - `/volunteers` and `/payments` visible to `Major_Admin`

### App routes
- `/` Home
- `/login` Login
- `/signup` Signup
- `/events` Events
- `/schedule` Schedule
- `/teams` Teams browsing / create team / join team
- `/leaderboard` Leaderboard
- `/complaints` Complaints
- `/announcements` Public announcements
- `/approvals` Protected approval workflow
- `/volunteers` Protected admin volunteer management
- `/payments` Protected admin payment management
- `/dashboard` Participant dashboard
- `/committee` Committee dashboard
- `/admin` Major Admin dashboard

> Note: There is a `frontend/src/pages/Register.js` page component, but the current route configuration maps `/register` to `Teams` instead of `Register`.

> Note: An `InlineMessage` component was added and is now wired into `CommitteeDashboard` and `AdminDashboard` to show localized feedback near buttons. Consider wiring it into other high-action pages as well (see recommended next steps).

## End-to-End Lifecycle

### 1. Game creation + approval
- Major Admin creates a game (`POST /api/games`)
- Student or Major Admin submits an approval request (`POST /api/approvals/request`)
- Major Admin approves or rejects the request (`PATCH /api/approvals/:id/review`)
- Game status and approval status are synchronized

### 2. Team registration and verification
- Student creates a team (`POST /api/teams`) or joins existing team (`POST /api/teams/:id/join`)
- Captain can submit the team for verification (`POST /api/teams/:id/submit-for-verification`)
- Committee member or Major Admin verifies/rejects teams (`POST /api/teams/:id/verify`)

### 3. Fixture generation and scheduling
- Committee or Major Admin generates fixtures (`POST /api/matches/generate-fixtures`)
- Matches are created in `matches`
- Admin may review conflicts at `/api/matches/conflicts`
- Committee can reschedule or swap opponents via match edit UI

### 4. Live scoring and bracket progression
- Scores published through `/api/matches/:id/score`
- Backend enforces monotonic score updates and bracket advancement
- Match status updates propagate to leaderboards and dashboards

### 5. Volunteer and attendance tracking
- Volunteer profiles created via `/api/volunteers`
- Shifts assigned via `/api/volunteers/shifts`
- QR token generated for each shift
- Attendance recorded via `/api/volunteers/shifts/:id/scan`
- Attendance ledger displayed in admin UI

### 6. Payment staging
- Rates configured via `/api/payments/rates`
- Payment preview generated via `/api/payments/calculate`
- Payment records staged through `/api/payments/stage`
- Admin reviews staged payments in `/api/payments`

## State Validation
- Checked modified backend route files: no errors found in `backend/src/routes/approvals.js`, `volunteers.js`, `payments.js`, `matches.js`
- Checked frontend pages: no errors found in `frontend/src/pages/Approvals.js`, `VolunteerManagement.js`, `Payments.js`, `CommitteeDashboard.js`, `AdminDashboard.js`
- The `resolveEntityId` helper is present and used for descriptive game/team/volunteer lookup
 - Checked new/updated frontend UI files: no errors found in `frontend/src/components/ui/InlineMessage.js`, `frontend/src/components/ui/MatchStatusBadge.js`, `frontend/src/pages/Schedule.js`, `frontend/src/index.css`

## Caveats / Remaining gaps
- `/register` route currently resolves to the `Teams` page instead of the dedicated `Register` page component
- QR workflow is implemented at the backend API level but has no camera/QR image UI in the frontend
- Payment staging records are created, but there is no final payout execution flow beyond changing payment record status
- Inline feedback (`InlineMessage`) is now wired into the committee and admin dashboards, but several other high-action pages still do not use it yet (`Teams.js` create/join flows, `VolunteerManagement.js` shift actions, `Payments.js` staging/execute actions).

## Recommended next steps
- Fix `/register` route to render `frontend/src/pages/Register.js`
- Add UI for QR code display and scanner-based attendance capture
- Add a payment approval / payout execution UI for `payments` records
- Expand participant registration UI to support team lookup by descriptive text
- Wire `InlineMessage` into other interactive pages (`Teams.js`, `VolunteerManagement.js`, `Payments.js`, and any create/join forms) so feedback appears inline at the point of action.
- Verify schedule polling and match-status visuals in the live schedule by running the frontend and exercising a publish-score and schedule update (confirm `InlineMessage` appears near the button and does not require scrolling).

## Example: Complete Football Game Execution for 300 Persons

Assume the sports week has 300 people participating in a football event.
- P1 = Major Admin
- P2 = Committee Member
- P120 = one student participant
- The remaining participants are other students, teams, volunteers, and spectators

This example shows the full process from the very beginning until the football game is completely finished.

### 1. System setup before the tournament starts
1. P1 logs into the system through the admin dashboard.
2. P1 creates the football game in the system.
3. P1 enters basic information such as game name, sport type, date, venue, team size, number of rounds, and rules.
4. P1 sets the game status to active and marks it for approval if required.
5. P1 may also assign P2 as the committee member for this football game.
6. The system stores the football game record and makes it visible to students and committees.

### 2. Approval and permission step
1. P1 or a student submits an approval request for the football event if the workflow is enabled.
2. The request is stored in the approvals module.
3. P1 reviews the request.
4. P1 approves the event if everything is correct.
5. The game status and approval status are updated in the system.
6. Once approved, the football event becomes officially open for registration.

### 3. Student registration and team formation
1. P120 logs in as a student.
2. P120 opens the teams page.
3. P120 either creates a new football team or joins an existing one.
4. If P120 creates a team, the system creates a team record and assigns P120 as captain or leader.
5. P120 adds other students to the team.
6. The team submits itself for verification.
7. P2 or P1 reviews the team details.
8. The team is verified or rejected.
9. After verification, the team is accepted into the football competition.

### 4. Team and player preparation
1. P1 or P2 checks how many teams have registered.
2. The system confirms that enough teams exist to start the tournament.
3. P1 or P2 reviews team names, player lists, and eligibility.
4. If any team is incomplete or invalid, it can be corrected before scheduling.
5. Once the team list is finalized, the system is ready for fixture generation.

### 5. Fixture generation and match scheduling
1. P2 or P1 generates football fixtures for the tournament.
2. The system creates match records for each team pairing.
3. Each match gets a date, time, venue, and status.
4. The schedule is published so players and volunteers can see it.
5. If there is a conflict, P2 or P1 resolves it.
6. The final schedule is confirmed.

### 6. Volunteer and support preparation
1. P1 or P2 creates volunteer profiles for the football event.
2. Volunteers are assigned to tasks such as scoring, refereeing, crowd control, and venue setup.
3. Each volunteer shift is created in the system.
4. A QR token or attendance code is generated for volunteer tracking.
5. Volunteers are informed about their shifts.

### 7. Match day start
1. On the match day, the teams arrive at the venue.
2. P2 checks the match schedule and confirms the teams are present.
3. Volunteers take their assigned positions.
4. The match is marked as live or in progress in the system.
5. The referee or committee member starts the football match.

### 8. Live match execution
1. The football game starts.
2. The live score is updated during the match.
3. P2 or the assigned committee member publishes the score in the system after each goal or important event.
4. The system updates the live match status.
5. The score and status are reflected on dashboards, leaderboards, and public views.
6. If the match is tied or needs extra time, the system can support the updated progression flow.

### 9. Match completion and result recording
1. The match ends.
2. P2 records the final result in the system.
3. The system marks the match as completed.
4. The winner and loser are saved in the match record.
5. The leaderboard is updated based on the new result.
6. Notifications are sent to the involved teams and participants.

### 10. Tournament progression
1. If the tournament uses a league system, the points table is updated.
2. If the tournament uses knockout rounds, the winner advances to the next round.
3. The next fixture is created and scheduled automatically or manually.
4. The process repeats for each football match until the final game.

### 11. Final match and championship result
1. The final football match is played.
2. P2 records the final score.
3. The winner of the tournament is confirmed.
4. The system updates the final standings and leaderboard.
5. The tournament result is displayed to the public and participants.

### 12. Closing steps after the football event
1. P2 confirms that all matches are completed.
2. P1 reviews the final score sheet and event report.
3. Volunteer attendance is marked complete.
4. Payments and payouts can be staged if applicable.
5. Announcements are posted about the winner and closing ceremony.
6. Complaints or disputes, if any, are reviewed by the admin or committee.
7. The football event is marked as fully completed in the system.

### 13. Simple summary of the complete flow
- Create the football game
- Approve the event
- Students register and form teams
- Teams get verified
- Fixtures are generated
- Volunteers are assigned
- Matches are played
- Scores are published
- Results are recorded
- Leaderboard updates
- Final winner is declared
- Event closes and reports are finalized

This example shows that even a single football game in the system includes many small steps, but each step is important for a smooth and fair tournament execution.
