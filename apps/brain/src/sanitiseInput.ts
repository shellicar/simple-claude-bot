/**
 * Sanitise user input to prevent system-reminder injection attacks.
 *
 * The Claude SDK prepends `<system-reminder>` XML blocks to user messages
 * before sending them to the API. If a user includes these tags in their
 * own message (via Discord, etc.), the model cannot distinguish them from
 * real SDK-injected reminders.
 *
 * This module HTML-encodes `<system-reminder>` and `</system-reminder>` tags
 * in user content so they render as visible text rather than parseable XML.
 * Real SDK reminders are injected AFTER this sanitisation step, so they
 * remain functional.
 */

const SYSTEM_REMINDER_OPEN = /<system-reminder>/gi;
const SYSTEM_REMINDER_CLOSE = /<\/system-reminder>/gi;

export function sanitiseSystemReminders(input: string): string {
  return input.replace(SYSTEM_REMINDER_OPEN, '&lt;system-reminder&gt;').replace(SYSTEM_REMINDER_CLOSE, '&lt;/system-reminder&gt;');
}
