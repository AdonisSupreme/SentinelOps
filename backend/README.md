# SentinelOps Backend Service

Backend service for managing automated checklist instance creation and status updates for SentinelOps.

## Features

### 🕐 Automated Instance Creation
- **Startup Check**: Creates missing checklist instances for current day when backend starts
- **Scheduled Creation**: Automatically creates daily instances at 04:00 UTC
- **Three Shift Coverage**: Creates instances for Morning (07:00-15:00), Afternoon (15:00-23:00), and Night (23:00-07:00) shifts

### 📊 Dynamic Status Management
- **Real-time Updates**: Updates instance statuses every minute
- **Automatic Transitions**: 
  - `SCHEDULED` → `IN_PROGRESS` → `COMPLETED`
  - Auto-completes pending items at shift end
- **Status Tracking**: Tracks creation, update, and completion timestamps

### 🔄 Shift Management
- **Morning Shift**: 07:00 - 15:00 (8 hours)
- **Afternoon Shift**: 15:00 - 23:00 (8 hours)  
- **Night Shift**: 23:00 - 07:00 (8 hours, overnight)

## Installation

```bash
cd backend
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

## Running the Service

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## API Endpoints

### Templates
- `GET /api/v1/checklists/templates` - Get all templates
- `GET /api/v1/checklists/templates?shift=MORNING` - Get templates by shift

### Instances
- `POST /api/v1/checklists/instances` - Create new instance
- `GET /api/v1/checklists/instances/today` - Get today's instances
- `GET /api/v1/checklists/instances/:id` - Get specific instance
- `PATCH /api/v1/checklists/instances/:instanceId/items/:itemId` - Update item status

### Health
- `GET /health` - Service health check

## Scheduled Tasks

### Daily Instance Creation (04:00 UTC)
```javascript
cron.schedule('0 4 * * *', async () => {
  await ensureDailyInstances();
  await updateInstanceStatuses();
});
```

### Status Updates (Every Minute)
```javascript
cron.schedule('* * * * *', async () => {
  await updateInstanceStatuses();
});
```

## Instance Status Flow

1. **SCHEDULED**: Instance created, waiting for shift start
2. **IN_PROGRESS**: Shift has started, items can be completed
3. **COMPLETED**: Shift has ended, all items auto-completed

## Auto-completion Logic

At shift end:
- All `PENDING` items marked as `COMPLETED`
- Completion timestamp set to shift end time
- Notes added: "Auto-completed at shift end"

## Error Handling

- **Template Not Found**: Returns 400 with descriptive error
- **Instance Not Found**: Returns 404 for missing instances
- **Task Failures**: Logged but don't crash the service

## Logging

Comprehensive logging with timestamps:
- `[INFO]` - Normal operations
- `[WARN]` - Non-critical issues
- `[ERROR]` - Errors and failures

## Data Storage

Currently uses in-memory Map storage. Production deployment should use:
- MongoDB, PostgreSQL, or similar database
- Persistent storage for instances and templates
- Backup and recovery mechanisms

## Monitoring

Health endpoint provides:
- Service status
- Current timestamp
- Instance count
- Template count

## Security

- CORS configured for frontend domain
- Request validation
- Error message sanitization

## Development Notes

- Uses `node-cron` for scheduled tasks
- `uuid` for generating unique IDs
- `axios` for potential external API calls
- `dotenv` for environment configuration

## Future Enhancements

- Database integration
- User authentication
- Role-based access control
- Audit logging
- Performance metrics
- WebSocket real-time updates
