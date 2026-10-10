# Notification Workflows

## Overview

The system triggers notifications at key workflow events. Currently, email delivery is only wired for batch approval and session scheduling. Other events are logged but not yet emailed.

## Notification Events

### 1. Approval Requested

**Trigger:** Batch submitted for approval or approval decision made

**Recipients:** `approver_1` and `approver_2` emails

**Current Behavior:** Logs recipient emails but does not send actual email

**Log Output:**
```
[NOTIFICATION TRIGGERED] Batch {batch_id} submitted for approval. Approver 1: {approver_1_id}, Approver 2: {approver_2_id}
Approval email for batch {batch_id}, event: {event_type}, recipients: {emails}
```

### 2. Batch Approved

**Trigger:** Batch approved via `/batches/{id}/approve`

**Recipients:** `primary_manager.email`, `sales_spoc.email`

**Email Content:**
- Subject: `Batch Approved: {batch_id}`
- Body: Batch ID, Approval ID, message to proceed with scheduling

**Failure Handling:** Wrapped in try/except, failure is silent

### 3. Session Scheduled

**Trigger:** New session created via `/sessions`

**Recipients:** `faculty_email` (if available)

**Email Content:**
- Subject: `Session Scheduled: {topic} on {date_str}`
- Body: Faculty name, topic, date

**Conditions:**
- Only sent if `faculty_email` is provided
- Faculty name is logged even if no email

### 4. Gate Completion

**Trigger:** Gate 1 or Gate 2 completed

**Recipients:** None (logged only)

**Log Output:**
```
[NOTIFICATION TRIGGERED] Quality Gate '{gate_name}' completed for Batch {batch_id} with Score: {score}
```

**Current Behavior:** No email sent, only logging

## Email Service Configuration

**SMTP Settings:**
- `SMTP_HOST`: Default `localhost`
- `SMTP_PORT`: Default `587`
- `SMTP_TLS`: Default `True`
- `EMAIL_FROM`: Default `noreply@enterprise-ops.com`
- `EMAIL_FROM_NAME`: Default `Enterprise Ops Platform`
- `FRONTEND_URL`: Default `http://localhost:3000`

**Fallback Behavior:**
- If SMTP not configured: logs `[EMAIL] SMTP not configured. Would send to {email}: {subject}`
- Returns `False` to indicate email not sent

## Welcome Email

When admin creates a user via `/auth/users/admin-create`:

**Conditions:**
- `send_welcome_email` flag is true (default)
- SMTP is configured

**Content:**
- Subject: `Welcome to Enterprise Ops Platform - Your Account Credentials`
- Includes auto-generated temporary password
- Contains security notice to change password on first login
- Includes login link: `{FRONTEND_URL}/login`

## Audit Log Integration

All notification events are also recorded in `audit_logs` table with event types:
- `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`
- `PASSWORD_CHANGE`, `PASSWORD_RESET_ADMIN`
- `ACCOUNT_LOCKED`, `ACCOUNT_UNLOCKED`
- `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`
- `ROLE_ASSIGNED`
- `REFRESH_TOKEN_USED`, `REFRESH_TOKEN_FAILED`

## AuditLog Model Fields (from SQLAlchemy)

- `id` (UUID, PK)
- `event_type` (Enum: AuditEventType)
- `user_id` (FK to users.id, SET NULL)
- `user_email` (String, indexed)
- `ip_address` (String, nullable)
- `user_agent` (Text, nullable)
- `details` (Text, nullable)
- `created_at` (TIMESTAMPTZ, indexed)

## Notification Service (from backend/app/core/email.py)

The email service provides:
- `send_email(to_email, subject, body)` - Basic email sending
- `send_batch_approval_email(batch, approver_emails)` - Batch approval notification
- `send_session_scheduled_email(faculty_email, session_details)` - Session scheduling notification
- `send_welcome_email(user_email, temp_password)` - New user welcome email

All email functions are async-safe (wrapped in try/except) and return boolean success indicator.