---
description: Complete checklist items and navigate between them on the ChecklistPage
---

# Checklist Page - Item Workflow

This workflow describes how to complete checklist items and navigate between them on the ChecklistPage.

## Complete an Item

1. **Select the item** you want to work on from the timeline
   - Click on any item card to expand it
   - The item will show its current status and available actions

2. **Choose the appropriate action**:
   - **Start Work**: Changes status from PENDING → IN_PROGRESS
   - **Complete**: Changes status to COMPLETED (requires notes)
   - **Skip**: Changes status to SKIPPED (requires reason)
   - **Fail**: Changes status to FAILED (requires reason)

3. **Add required information**:
   - Enter notes about what was done
   - Provide reason if skipping or failing
   - Add attachments if needed (optional)

4. **Submit the action** by clicking the action button
   - The item status will update immediately
   - Activity will be logged with timestamp and user info
   - Progress bar will recalculate automatically

5. **Verify the update**:
   - Check that the item shows the new status
   - Review the activity timeline for the record
   - Confirm completion percentage updated

## Navigate Between Items

### Using the Timeline
- Scroll through the timeline section on the left
- Items are organized chronologically by scheduled time
- Click any item to expand/collapse its details

### Using Keyboard Shortcuts
- **Arrow Down**: Move to next item
- **Arrow Up**: Move to previous item
- **Enter**: Expand selected item or submit current action
- **Escape**: Collapse current item

### Filter and Search
- Use the search bar to find specific items by name
- Filter by status (Pending, In Progress, Completed, etc.)
- Filter by severity level

## Status Flow Rules

```
PENDING → IN_PROGRESS → COMPLETED
   ↓
SKIPPED (with reason)
   ↓
FAILED (with reason/escalation)
```

- Items marked as FAILED may trigger escalation workflow
- SKIPPED items require a reason and may affect completion percentage
- COMPLETED items can be reopened by admin users

## Tips

- Complete items in order when possible for better handover notes
- Add detailed notes for items that may need context for next shift
- Use the handover notes section to communicate issues between shifts
- Monitor the time remaining indicator to stay on schedule
