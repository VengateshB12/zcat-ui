<!-- Copied from the zcat Figma project's reference set so the rules travel
     with this clone. These are DESIGN decisions and apply in both modes;
     where a file mentions Figma mechanics (component keys, auto-layout,
     setProperties), take the decision and ignore the mechanism — none of
     it exists in code. Source of truth is the Figma project; re-copy if
     they diverge. -->

# Sample Data

Realistic sample data sets organized by domain. Use these instead of lorem ipsum when populating generated screens. Each domain provides 8-12 rows of varied, realistic data.

---

## Users / People

| Name | Email | Role | Department | Status | Joined | Avatar |
|---|---|---|---|---|---|---|
| Priya Sharma | priya.sharma@acme.com | Admin | Engineering | Active | 2024-01-15 | PS |
| Marcus Chen | marcus.chen@acme.com | Developer | Engineering | Active | 2024-03-22 | MC |
| Fatima Al-Rashid | fatima.ar@acme.com | Designer | Product | Active | 2023-11-08 | FA |
| James O'Brien | james.obrien@acme.com | Manager | Sales | Active | 2022-06-30 | JO |
| Yuki Tanaka | yuki.tanaka@acme.com | Developer | Engineering | Inactive | 2023-07-14 | YT |
| Amara Okafor | amara.okafor@acme.com | Analyst | Marketing | Active | 2024-05-01 | AO |
| Liam Novak | liam.novak@acme.com | Support Lead | Customer Success | Active | 2023-02-19 | LN |
| Sofia Gutierrez | sofia.g@acme.com | Developer | Engineering | Pending | 2025-01-10 | SG |
| Ravi Patel | ravi.patel@acme.com | VP of Product | Product | Active | 2021-09-05 | RP |
| Elena Voronova | elena.v@acme.com | QA Engineer | Engineering | Active | 2024-08-18 | EV |
| David Kim | david.kim@acme.com | Account Exec | Sales | Inactive | 2023-04-27 | DK |
| Nadia Benmoussa | nadia.b@acme.com | Content Writer | Marketing | Active | 2024-11-03 | NB |

---

## Projects / Products

| Project Name | Description | Status | Owner | Created | Tags |
|---|---|---|---|---|---|
| Atlas Dashboard | Real-time analytics dashboard for enterprise metrics | In Progress | Priya Sharma | 2025-08-12 | Analytics, Frontend |
| Meridian API | RESTful API gateway for third-party integrations | Completed | Marcus Chen | 2024-11-03 | API, Backend |
| Pulse Notifications | Push notification system for mobile and web | In Progress | Ravi Patel | 2025-06-20 | Notifications, Mobile |
| Onboarding Wizard | Step-by-step user onboarding and setup flow | Draft | Fatima Al-Rashid | 2026-01-08 | UX, Onboarding |
| Vault File Storage | Encrypted file storage and sharing service | In Progress | Elena Voronova | 2025-03-15 | Storage, Security |
| Beacon Search | Full-text search engine with AI-powered suggestions | Completed | Marcus Chen | 2024-07-22 | Search, AI |
| Nova Billing | Subscription billing and invoice management | In Progress | James O'Brien | 2025-10-01 | Billing, Finance |
| Echo Chat | Real-time messaging with threads and reactions | Draft | Sofia Gutierrez | 2026-03-14 | Chat, Real-time |
| Horizon Reports | Automated report generation and scheduling | Completed | Amara Okafor | 2025-01-30 | Reports, Automation |
| Shield Auth | Multi-factor authentication and SSO gateway | In Progress | Liam Novak | 2025-05-18 | Security, Auth |

---

## Functions / Services (Catalyst-specific)

| Function Name | Runtime | Last Executed | Executions (30d) | Status | Timeout |
|---|---|---|---|---|---|
| getUsers | Node.js 18 | 2026-08-04 09:12 | 14,230 | Active | 30s |
| processPayment | Java 17 | 2026-08-04 08:55 | 3,871 | Active | 60s |
| sendNotification | Node.js 18 | 2026-08-04 09:10 | 28,445 | Active | 15s |
| generateReport | Python 3.11 | 2026-08-03 23:00 | 892 | Active | 120s |
| validateToken | Node.js 18 | 2026-08-04 09:14 | 52,180 | Active | 10s |
| syncInventory | Java 17 | 2026-08-04 06:00 | 1,440 | Active | 90s |
| resizeImage | Python 3.11 | 2026-08-04 07:30 | 5,620 | Active | 45s |
| cleanupExpired | Node.js 18 | 2026-08-04 00:00 | 30 | Active | 300s |
| importCSV | Python 3.11 | 2026-08-02 14:20 | 156 | Error | 180s |
| webhookHandler | Node.js 18 | 2026-08-04 09:15 | 41,300 | Active | 20s |
| archiveRecords | Java 17 | 2026-08-01 02:00 | 8 | Disabled | 600s |

---

## Analytics / Metrics

### KPI Cards

| Metric | Value | Change | Period |
|---|---|---|---|
| Total Users | 12,450 | +12.3% | vs last month |
| Monthly Revenue | $45,230 | +8.7% | vs last month |
| Conversion Rate | 3.2% | -0.4% | vs last month |
| Active Sessions | 1,847 | +22.1% | vs last week |
| Avg Response Time | 142ms | -18.5% | vs last month |
| Support Tickets | 89 | -31.2% | vs last month |

### Trend Data (Monthly)

| Month | Users | Revenue | Conversions |
|---|---|---|---|
| Feb 2026 | 9,120 | $32,400 | 2.8% |
| Mar 2026 | 9,850 | $35,100 | 2.9% |
| Apr 2026 | 10,200 | $37,800 | 3.1% |
| May 2026 | 10,890 | $39,500 | 3.0% |
| Jun 2026 | 11,340 | $42,100 | 3.3% |
| Jul 2026 | 11,900 | $43,800 | 3.4% |
| Aug 2026 | 12,450 | $45,230 | 3.2% |

---

## Tasks / Tickets

| ID | Title | Priority | Assignee | Due Date | Status |
|---|---|---|---|---|---|
| TASK-1042 | Fix login timeout on mobile browsers | High | Marcus Chen | 2026-08-06 | In Progress |
| TASK-1043 | Add CSV export to analytics dashboard | Medium | Priya Sharma | 2026-08-10 | Open |
| TASK-1044 | Update password policy to require 12 chars | High | Liam Novak | 2026-08-05 | In Progress |
| TASK-1045 | Design empty state illustrations for projects | Low | Fatima Al-Rashid | 2026-08-15 | Open |
| TASK-1046 | Optimize image upload compression pipeline | Medium | Elena Voronova | 2026-08-12 | Open |
| TASK-1047 | Investigate memory spike in report generation | High | Sofia Gutierrez | 2026-08-04 | Blocked |
| TASK-1048 | Write API docs for v2 billing endpoints | Medium | Amara Okafor | 2026-08-09 | In Progress |
| TASK-1049 | Add dark mode support to notification banners | Low | Fatima Al-Rashid | 2026-08-20 | Open |
| TASK-1050 | Migrate user table to partitioned schema | High | Marcus Chen | 2026-08-07 | In Progress |
| TASK-1051 | Set up automated regression test suite | Medium | Elena Voronova | 2026-08-14 | Done |
| TASK-1052 | Review and approve Q3 marketing assets | Low | Nadia Benmoussa | 2026-08-11 | Done |

---

## Files / Documents

| File Name | Size | Uploaded | Owner | Type |
|---|---|---|---|---|
| Q3-Revenue-Report.pdf | 2.4 MB | 2026-07-28 | James O'Brien | PDF |
| brand-guidelines-v3.pdf | 8.1 MB | 2026-06-15 | Fatima Al-Rashid | PDF |
| api-migration-plan.docx | 342 KB | 2026-07-20 | Marcus Chen | DOCX |
| product-roadmap-2026.xlsx | 1.1 MB | 2026-07-01 | Ravi Patel | XLSX |
| hero-banner-final.png | 4.7 MB | 2026-07-22 | Fatima Al-Rashid | PNG |
| customer-survey-results.csv | 890 KB | 2026-07-30 | Amara Okafor | CSV |
| architecture-diagram.svg | 156 KB | 2026-08-01 | Priya Sharma | SVG |
| onboarding-flow-v2.fig | 12.3 MB | 2026-07-25 | Fatima Al-Rashid | FIG |
| release-notes-4.2.md | 28 KB | 2026-08-02 | Liam Novak | MD |
| security-audit-2026.pdf | 5.6 MB | 2026-06-30 | Elena Voronova | PDF |
| team-photo-offsite.jpg | 3.2 MB | 2026-07-18 | Nadia Benmoussa | JPG |

---

## Logs / Events

| Timestamp | Event Type | Message | Severity | Source |
|---|---|---|---|---|
| 2026-08-04 09:15:32 | API Request | GET /api/v2/users returned 200 (142ms) | Info | api-gateway |
| 2026-08-04 09:14:58 | Authentication | User marcus.chen@acme.com logged in via SSO | Info | auth-service |
| 2026-08-04 09:13:41 | Rate Limit | Rate limit exceeded for IP 203.45.67.89 (150 req/min) | Warning | api-gateway |
| 2026-08-04 09:12:07 | Database | Connection pool exhausted, queuing requests (pool: 50/50) | Error | db-primary |
| 2026-08-04 09:10:55 | Deployment | Build #4217 deployed to production (v4.2.1) | Info | ci-pipeline |
| 2026-08-04 09:08:22 | Payment | Payment $149.00 processed for invoice INV-2026-0891 | Info | billing-service |
| 2026-08-04 09:05:33 | Storage | File upload completed: hero-banner-final.png (4.7 MB) | Info | storage-service |
| 2026-08-04 09:02:14 | Notification | Email delivery failed: bounce for user@invalid.test | Warning | notification-svc |
| 2026-08-04 08:58:47 | Security | Failed login attempt (5th) for admin@acme.com from 198.51.100.12 | Critical | auth-service |
| 2026-08-04 08:55:01 | Cron Job | Scheduled task cleanupExpired completed in 12.4s | Info | scheduler |
| 2026-08-04 08:50:19 | Cache | Cache miss rate exceeded 40% threshold (current: 43.2%) | Warning | cache-service |
| 2026-08-04 08:45:30 | System | Memory usage at 87% on worker-node-03, scaling triggered | Error | infra-monitor |

---

## Settings / Configuration

| Setting | Description | Current Value | Type |
|---|---|---|---|
| App Name | Display name shown in browser tab and header | Acme Platform | Text |
| Default Language | Language for new users and system emails | English (US) | Dropdown |
| Session Timeout | Auto-logout after inactivity period | 30 minutes | Dropdown |
| Two-Factor Auth | Require 2FA for all user accounts | Enabled | Toggle |
| Email Notifications | Send email alerts for system events | Enabled | Toggle |
| Max Upload Size | Maximum file upload size per request | 25 MB | Number |
| API Rate Limit | Maximum API requests per minute per user | 120 req/min | Number |
| Maintenance Mode | Restrict access to admin users only | Disabled | Toggle |
| Data Retention | Days to keep deleted records before purge | 90 days | Number |
| Default Theme | Color theme for new user accounts | System (Auto) | Dropdown |
| Signup Enabled | Allow new user self-registration | Enabled | Toggle |
| Audit Logging | Log all user actions for compliance | Enabled | Toggle |
