# Requirements Document

## Introduction

This feature adds a daily rate limit to the AI-powered transaction parsing capability in Shukra. Authenticated Supabase users are limited to 6 AI prompt submissions per calendar day. The limit is enforced server-side at the `/api/parse-transaction` endpoint and surfaced to the user in the transaction input UI so they always know how many prompts remain. The counter resets at midnight UTC each day.

## Glossary

- **Rate_Limiter**: The server-side component responsible for tracking and enforcing the daily prompt quota per user.
- **Parse_Transaction_API**: The Next.js API route at `/api/parse-transaction` that accepts a transaction description and returns a parsed journal entry via an AI model.
- **Prompt**: A single submission to the Parse_Transaction_API by an authenticated user.
- **Daily_Quota**: The maximum number of Prompts an authenticated user may submit within a single UTC calendar day. Currently defined as 6.
- **Usage_Counter**: The persistent record of how many Prompts a user has submitted on the current UTC calendar day, stored in Supabase.
- **Transaction_Input**: The client-side React component (`transaction-input.tsx`) through which users submit transaction descriptions.
- **Authenticated_User**: A user with a valid Supabase session, identified by their Supabase user ID.

## Requirements

### Requirement 1: Enforce Daily Prompt Quota at the API

**User Story:** As a product owner, I want AI prompt usage to be capped at 6 per user per day, so that infrastructure costs remain predictable and the service is not abused.

#### Acceptance Criteria

1. WHEN an Authenticated_User submits a Prompt to the Parse_Transaction_API AND their Usage_Counter for the current UTC calendar day is below 6 (the Daily_Quota), THE Rate_Limiter SHALL increment the Usage_Counter for that user for the current UTC calendar day before invoking the AI model.
2. WHEN an Authenticated_User submits a Prompt AND their Usage_Counter for the current UTC calendar day has already reached 6 (the Daily_Quota), THE Parse_Transaction_API SHALL return an HTTP 429 response without invoking the AI model and without incrementing the Usage_Counter. The HTTP 429 response SHALL only be returned when the Daily_Quota is actually reached, not for any other condition.
3. WHEN the Parse_Transaction_API returns an HTTP 429 response, THE Parse_Transaction_API SHALL include in the response body the UTC reset timestamp as an ISO 8601 UTC datetime string representing 00:00:00 of the next UTC calendar day (e.g., "2026-05-24T00:00:00Z").
4. WHEN an Authenticated_User submits a Prompt AND their Usage_Counter for the current UTC calendar day is below the Daily_Quota, THE Parse_Transaction_API SHALL invoke the AI model and return its response.
5. IF an unauthenticated request is received by the Parse_Transaction_API, THEN THE Parse_Transaction_API SHALL return an HTTP 401 response without invoking the AI model or modifying any Usage_Counter.

### Requirement 2: Persist Usage Counts in Supabase

**User Story:** As a developer, I want usage counts stored in Supabase, so that the rate limit is consistent across server restarts, multiple instances, and browser sessions.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL store each user's Usage_Counter in a dedicated Supabase table keyed by user ID and UTC calendar date.
2. WHEN a new UTC calendar day begins, THE Rate_Limiter SHALL treat any Usage_Counter record from a prior UTC date as not counting toward the current UTC date's quota, and SHALL create a new record for the current UTC date starting at zero if one does not already exist.
3. IF a Supabase write operation for the Usage_Counter fails, THEN THE Rate_Limiter SHALL deny the Prompt and return an HTTP 503 response to prevent untracked usage, regardless of the user's last known count.
4. WHEN N concurrent Prompt requests are received from the same Authenticated_User within the same UTC calendar day, THE Rate_Limiter SHALL result in the Usage_Counter being incremented by exactly N, with no increments lost or duplicated.
5. IF a Supabase read operation for the Usage_Counter fails, THEN THE Rate_Limiter SHALL deny the Prompt and return an HTTP 503 response, as the quota cannot be enforced without reading the current count.

### Requirement 3: Display Remaining Prompts in the UI

**User Story:** As an authenticated user, I want to see how many AI prompts I have left today, so that I can plan my usage and am not surprised by a sudden block.

#### Acceptance Criteria

1. WHILE an Authenticated_User is viewing the Transaction_Input, THE Transaction_Input SHALL display the number of remaining Prompts available for the current UTC calendar day in the format "X of 6 remaining".
2. WHEN the Parse_Transaction_API returns an HTTP 429 response, THE Transaction_Input SHALL display a message indicating the Daily_Quota has been reached and SHALL include the reset time in the user's local timezone formatted as a time-of-day string (e.g., "12:00 AM").
3. WHEN the remaining Prompt count is zero, THE Transaction_Input SHALL disable the submit button and the natural-language input field.
4. WHEN the remaining Prompt count is greater than zero, THE Transaction_Input SHALL enable the submit button and the natural-language input field.
5. WHEN an Authenticated_User successfully submits a Prompt and the Parse_Transaction_API returns an HTTP 200 response, THE Transaction_Input SHALL update the displayed remaining Prompt count to the value returned in the API response body's remaining count field.
6. WHEN the Parse_Transaction_API returns a response that is neither HTTP 200 nor HTTP 429, THE Transaction_Input SHALL preserve the existing displayed remaining Prompt count and SHALL display an error message to the user.

### Requirement 4: Expose Remaining Quota in the API Response

**User Story:** As a developer, I want the API to return current quota information on every response, so that the client can keep the UI in sync without a separate round-trip.

#### Acceptance Criteria

1. WHEN the Parse_Transaction_API returns an HTTP 200 response, THE Parse_Transaction_API SHALL include the remaining Prompt count for the current UTC calendar day and the UTC reset timestamp in the response body.
2. WHEN the Parse_Transaction_API returns an HTTP 429 response, THE Parse_Transaction_API SHALL include a remaining count of zero and the UTC reset timestamp in the response body.
3. THE Parse_Transaction_API SHALL return the remaining Prompt count as a non-negative integer.

### Requirement 5: Fetch Initial Quota on Page Load

**User Story:** As an authenticated user, I want the UI to show my correct remaining prompt count when I first open the app, so that the display is accurate before I submit anything.

#### Acceptance Criteria

1. WHEN an Authenticated_User loads the application, THE Transaction_Input SHALL fetch the current Usage_Counter for the Authenticated_User and display the correct remaining Prompt count.
2. IF the quota fetch request fails on page load, THEN THE Transaction_Input SHALL display the input as enabled and show an indeterminate quota state rather than blocking the user.
