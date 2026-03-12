# Email Sequence Trigger Types

## Available Triggers in Project Solo

### lead_captured
Fires when a new lead is added via opt-in form or API.
- **Use for**: Welcome series, lead magnet delivery
- **Data available**: email, name, source, tags

### product_purchased
Fires when a Stripe checkout completes successfully.
- **Use for**: Post-purchase onboarding, upsell sequences
- **Data available**: product name, price, customer email

### course_enrolled
Fires when a user is granted access to a course/module.
- **Use for**: Course onboarding, lesson reminders
- **Data available**: course name, module count, student email

### tag_added
Fires when a specific tag is applied to a lead or customer.
- **Use for**: Interest-based nurture, segmented campaigns
- **Data available**: tag name, contact email, added_by

### manual
Triggered manually by admin or via API call.
- **Use for**: One-off campaigns, testing, custom workflows
- **Data available**: whatever is passed in the trigger payload

## Sequence Step Configuration

Each step in a sequence has:
- **delay_days**: Days after the previous step (or trigger for first step)
- **delay_hours**: Additional hours of delay
- **subject**: Email subject line (supports merge fields)
- **body**: Email body content (markdown, supports merge fields)
- **condition**: Optional — skip step if condition is not met

## Merge Fields

Available in subject and body:
- `{{first_name}}` — Contact's first name
- `{{email}}` — Contact's email
- `{{product_name}}` — Product that triggered the sequence
- `{{business_name}}` — From site_config
- `{{unsubscribe_url}}` — Auto-generated unsubscribe link
