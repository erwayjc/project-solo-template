---
name: Content Calendar
description: Plan and organize content publishing schedules across blog, social media, and email channels. Covers content pillars, frequency cadences, and cross-platform coordination. Use when the user asks about content planning, publishing schedules, or content strategy.
agents: [dev-agent, content-director]
tags: [content, social, planning, calendar]
invocation: both
---

## Content Calendar Playbook

### Content Pillar Framework

Define 3-5 content pillars aligned with your business:
1. **Educational**: Teach your audience something valuable
2. **Inspirational**: Share stories, wins, and transformations
3. **Promotional**: Highlight products, offers, and results
4. **Community**: Engage, ask questions, share user content
5. **Behind-the-scenes**: Build trust through transparency

### Recommended Cadences

**Blog**
- Minimum: 1 post/week
- Ideal: 2-3 posts/week for SEO growth
- Mix: 70% evergreen, 30% timely/trending

**Social Media**
- Instagram/Facebook: 3-5 posts/week
- Twitter/X: 1-3 posts/day
- LinkedIn: 2-4 posts/week
- Each platform gets native-format content (not identical cross-posts)

**Email**
- Newsletter: 1/week (consistent day/time)
- Broadcasts: 1-2/month for promotions
- Sequences run independently of broadcast schedule

### Planning Process

1. **Monthly**: Choose themes aligned with business goals and launches
2. **Weekly**: Plan specific topics, assign to content pillars
3. **Daily**: Create, schedule, and engage

### Cross-Platform Strategy
- Blog post → 3-5 social media posts → 1 email newsletter feature
- Email sequence content → repurpose as blog posts
- Social engagement themes → expand into blog content
- One piece of long-form content should generate 5-10 micro-content pieces

### Content Queue Integration
Use the content_queue table to schedule posts:
- Set `platform`, `content`, `scheduled_for`, `status`
- Buffer integration publishes automatically when connected
- Track performance via engagement metrics
