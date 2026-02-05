const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Logger
const logger = {
  info: (message, data = {}) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, data);
  },
  error: (message, data = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, data);
  },
  warn: (message, data = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, data);
  }
};

// Configuration
const SHIFTS = {
  MORNING: { start: '07:00', end: '15:00', name: 'Morning Shift' },
  AFTERNOON: { start: '15:00', end: '23:00', name: 'Afternoon Shift' },
  NIGHT: { start: '23:00', end: '07:00', name: 'Night Shift' }
};

// Mock data storage (in production, use a database)
const checklistInstances = new Map();
const templates = new Map();

// Initialize default templates
function initializeTemplates() {
  const defaultTemplates = [
    {
      id: 'morning-template',
      name: 'Morning Operations Checklist',
      description: 'Morning shift checklist for daily operations',
      shift: 'MORNING',
      version: 1,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'afternoon-template',
      name: 'Afternoon Operations Checklist',
      description: 'Afternoon shift checklist for daily operations',
      shift: 'AFTERNOON',
      version: 1,
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'night-template',
      name: 'Night Operations Checklist',
      description: 'Night shift checklist for daily operations',
      shift: 'NIGHT',
      version: 1,
      is_active: true,
      created_at: new Date().toISOString()
    }
  ];

  defaultTemplates.forEach(template => {
    templates.set(template.id, template);
  });

  logger.info('Default templates initialized', { count: defaultTemplates.length });
}

// Helper functions
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function getCurrentShift() {
  const hour = new Date().getHours();
  
  if (hour >= 7 && hour < 15) return 'MORNING';
  if (hour >= 15 && hour < 23) return 'AFTERNOON';
  return 'NIGHT';
}

function getShiftEndTime(shift) {
  const now = new Date();
  
  switch (shift) {
    case 'MORNING':
      now.setHours(15, 0, 0, 0); // 15:00
      break;
    case 'AFTERNOON':
      now.setHours(23, 0, 0, 0); // 23:00
      break;
    case 'NIGHT':
      // Night shift ends at 07:00 next day
      now.setDate(now.getDate() + 1);
      now.setHours(7, 0, 0, 0);
      break;
  }
  
  return now;
}

function getShiftStatus(startTime, endTime, currentStatus) {
  const now = new Date();
  
  // If already completed or completed with exceptions, don't change
  if (currentStatus === 'COMPLETED' || currentStatus === 'COMPLETED_WITH_EXCEPTIONS') {
    return currentStatus;
  }
  
  if (now >= endTime) {
    // Time elapsed - should be pending review, not auto-completed
    return 'PENDING_REVIEW';
  } else if (now >= startTime) {
    return 'IN_PROGRESS';
  } else {
    return 'OPEN'; // Before shift starts
  }
}

// Core functionality
async function createChecklistInstance(templateId, shift, date = getCurrentDate()) {
  const template = templates.get(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const now = new Date();
  const instanceId = uuidv4();
  const shiftEndTime = getShiftEndTime(shift);

  // Create mock checklist items based on the template
  const mockItems = [
    {
      id: uuidv4(),
      title: 'System Status Check',
      description: 'Verify all systems are operational',
      item_type: 'ROUTINE',
      is_required: true,
      scheduled_time: null,
      severity: 1,
      sort_order: 1
    },
    {
      id: uuidv4(),
      title: 'Security Protocols Review',
      description: 'Review and update security measures',
      item_type: 'ROUTINE',
      is_required: true,
      scheduled_time: null,
      severity: 2,
      sort_order: 2
    },
    {
      id: uuidv4(),
      title: 'Team Briefing',
      description: 'Conduct team briefing and handover',
      item_type: 'SCHEDULED_EVENT',
      is_required: false,
      scheduled_time: '08:00',
      severity: 1,
      sort_order: 3
    },
    {
      id: uuidv4(),
      title: 'Equipment Check',
      description: 'Verify all equipment is functioning',
      item_type: 'ROUTINE',
      is_required: true,
      scheduled_time: null,
      severity: 3,
      sort_order: 4
    },
    {
      id: uuidv4(),
      title: 'Documentation Update',
      description: 'Update relevant documentation',
      item_type: 'INFORMATIONAL',
      is_required: false,
      scheduled_time: null,
      severity: 1,
      sort_order: 5
    }
  ];

  const instance = {
    id: instanceId,
    template: template,
    checklist_date: date,
    shift: shift,
    shift_start: now.toISOString(),
    shift_end: shiftEndTime.toISOString(),
    status: 'OPEN', // Changed from 'SCHEDULED' to 'OPEN' to match frontend enum
    created_by: null, // Add required field
    closed_by: null, // Add required field
    closed_at: null, // Add required field
    created_at: now.toISOString(),
    items: mockItems.map(item => ({
      id: item.id,
      item: item, // The checklist item template
      status: 'PENDING',
      completed_at: null,
      completed_by: null, // Add required field
      notes: null,
      attachments: [], // Add required field
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    })),
    participants: [], // Add required field
    notes: [], // Add required field
    attachments: [], // Add required field
    exceptions: [], // Add required field
    handover_notes: [] // Add required field
  };

  checklistInstances.set(instanceId, instance);
  
  logger.info('Created checklist instance', { 
    instanceId, 
    templateId, 
    shift,
    itemsCount: instance.items.length,
    firstItemTitle: instance.items[0]?.item?.title || 'NO TITLE',
    firstItemType: instance.items[0]?.item?.item_type || 'NO TYPE',
    dataStructure: 'item.item.title format'
  });
  
  console.log('🔍 Debug - Created instance with items:', {
    instanceId,
    itemsCount: instance.items.length,
    firstItem: instance.items[0],
    firstItemTitle: instance.items[0]?.item?.title,
    hasItemProperty: !!instance.items[0]?.item,
    itemProperties: instance.items[0]?.item ? Object.keys(instance.items[0].item) : []
  });
  
  return instance;
}

async function ensureDailyInstances() {
  const today = getCurrentDate();
  const shifts = ['MORNING', 'AFTERNOON', 'NIGHT'];
  
  logger.info('Checking for daily checklist instances', { date: today });

  for (const shift of shifts) {
    const templateId = `${shift.toLowerCase()}-template`;
    
    // Check if instance already exists for this shift today
    const existingInstance = Array.from(checklistInstances.values()).find(
      instance => instance.checklist_date === today && instance.shift === shift
    );

    if (!existingInstance) {
      try {
        await createChecklistInstance(templateId, shift, today);
        logger.info(`Created ${shift} checklist instance for ${today}`);
      } catch (error) {
        logger.error(`Failed to create ${shift} checklist instance`, { error: error.message });
      }
    } else {
      logger.info(`${shift} checklist instance already exists for ${today}`, { 
        instanceId: existingInstance.id 
      });
    }
  }
}

async function updateInstanceStatuses() {
  const now = new Date();
  logger.info('Updating checklist instance statuses');

  for (const [instanceId, instance] of checklistInstances.entries()) {
    const startTime = new Date(instance.shift_start);
    const endTime = new Date(instance.shift_end);
    const newStatus = getShiftStatus(startTime, endTime, instance.status);

    if (instance.status !== newStatus) {
      const oldStatus = instance.status;
      instance.status = newStatus;
      
      // Only set closed_at when transitioning to PENDING_REVIEW from active states
      if (newStatus === 'PENDING_REVIEW' && (oldStatus === 'OPEN' || oldStatus === 'IN_PROGRESS')) {
        instance.closed_at = now.toISOString();
        logger.info('Instance auto-transitioned to PENDING_REVIEW', {
          instanceId,
          shift: instance.shift,
          date: instance.checklist_date
        });
      }

      logger.info('Updated instance status', {
        instanceId,
        shift: instance.shift,
        oldStatus,
        newStatus,
        date: instance.checklist_date
      });
    }
  }
}

// Scheduled tasks
// Run every day at 04:00 to create instances for the day
cron.schedule('0 4 * * *', async () => {
  logger.info('Running daily instance creation task (04:00)');
  try {
    await ensureDailyInstances();
    await updateInstanceStatuses();
  } catch (error) {
    logger.error('Daily task failed', { error: error.message });
  }
}, {
  scheduled: true,
  timezone: "UTC"
});

// Run every minute to update statuses
cron.schedule('* * * * *', async () => {
  try {
    await updateInstanceStatuses();
  } catch (error) {
    logger.error('Status update task failed', { error: error.message });
  }
});

// API Routes
app.get('/api/v1/checklists/templates', (req, res) => {
  const { shift } = req.query;
  let result = Array.from(templates.values());
  
  if (shift) {
    result = result.filter(template => template.shift === shift.toUpperCase());
  }
  
  res.json(result);
});

app.post('/api/v1/checklists/instances', async (req, res) => {
  try {
    const { template_id, checklist_date, shift } = req.body;
    const instance = await createChecklistInstance(template_id, shift, checklist_date);
    res.status(201).json(instance);
  } catch (error) {
    logger.error('Create instance failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/v1/checklists/instances/today', (req, res) => {
  const today = getCurrentDate();
  let todayInstances = Array.from(checklistInstances.values()).filter(
    instance => instance.checklist_date === today
  );

  // Debug logging and migration for today's instances
  console.log('🔍 Backend Debug - Retrieving today instances:', {
    date: today,
    instancesCount: todayInstances.length,
    instanceIds: todayInstances.map(inst => inst.id)
  });

  // Check and migrate instances with old data structure
  todayInstances = todayInstances.map(instance => {
    // Server-side status check based on current time
    const now = new Date();
    const startTime = new Date(instance.shift_start);
    const endTime = new Date(instance.shift_end);
    const currentStatus = instance.status;
    
    if (currentStatus !== 'COMPLETED' && currentStatus !== 'COMPLETED_WITH_EXCEPTIONS') {
      let newStatus = currentStatus;
      if (now >= endTime) newStatus = 'PENDING_REVIEW';
      else if (now >= startTime) newStatus = 'IN_PROGRESS';
      
      if (newStatus !== currentStatus) {
        instance.status = newStatus;
        instance.updated_at = now.toISOString();
      }
    }
    if (instance.items && instance.items.length > 0) {
      const needsMigration = instance.items.some(item => 
        !item.item || 
        !item.item.title || 
        item.item.title === 'Untitled Item' ||
        !item.item.item_type ||
        typeof item.item.is_required !== 'boolean'
      );

      if (needsMigration) {
        console.log('🔄 Migrating today instance with old data structure:', instance.id);
        
        // Migrate items to new structure
        instance.items = instance.items.map((item, index) => {
          if (!item.item || !item.item.title) {
            // Create new item structure based on index
            const defaultItems = [
              { title: 'System Status Check', description: 'Verify all systems are operational', item_type: 'ROUTINE', is_required: true, scheduled_time: null, severity: 1 },
              { title: 'Security Protocols Review', description: 'Review and update security measures', item_type: 'ROUTINE', is_required: true, scheduled_time: null, severity: 2 },
              { title: 'Team Briefing', description: 'Conduct team briefing and handover', item_type: 'SCHEDULED_EVENT', is_required: false, scheduled_time: '08:00', severity: 1 },
              { title: 'Equipment Check', description: 'Verify all equipment is functioning', item_type: 'ROUTINE', is_required: true, scheduled_time: null, severity: 3 },
              { title: 'Documentation Update', description: 'Update relevant documentation', item_type: 'INFORMATIONAL', is_required: false, scheduled_time: null, severity: 1 }
            ];
            
            const newItem = {
              id: item.id,
              ...defaultItems[index % defaultItems.length],
              sort_order: index + 1
            };
            
            return {
              ...item,
              item: newItem
            };
          }
          
          // Ensure all required properties exist
          return {
            ...item,
            item: {
              ...item.item,
              item_type: item.item.item_type || 'ROUTINE',
              is_required: typeof item.item.is_required === 'boolean' ? item.item.is_required : !!item.item.required,
              scheduled_time: item.item.scheduled_time || null,
              severity: item.item.severity || 1
            }
          };
        });

        console.log('✅ Today instance migrated successfully:', {
          instanceId: instance.id,
          newItemsCount: instance.items.length,
          firstItemTitle: instance.items[0]?.item?.title,
          allItemTitles: instance.items.map(item => item.item?.title || 'NO TITLE')
        });
      }
    }
    
    return instance;
  });

  console.log('🔍 Backend Debug - Today instances after migration:', {
    instancesCount: todayInstances.length,
    firstInstanceItems: todayInstances[0]?.items?.map(item => item.item?.title || 'NO TITLE')
  });

  res.json(todayInstances);
});

app.get('/api/v1/checklists/instances/:id', (req, res) => {
  const { id } = req.params;
  const instance = checklistInstances.get(id);
  
  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  // Debug logging for instance retrieval
  console.log('🔍 Backend Debug - Retrieving instance:', {
    instanceId: id,
    itemsCount: instance.items?.length || 0,
    firstItem: instance.items?.[0],
    firstItemTitle: instance.items?.[0]?.item?.title,
    firstItemStructure: instance.items?.[0] ? Object.keys(instance.items[0]) : [],
    firstItemItemStructure: instance.items?.[0]?.item ? Object.keys(instance.items[0].item) : [],
    hasItemProperty: !!(instance.items?.[0]?.item),
    allItemTitles: instance.items?.map(item => item.item?.title || 'NO TITLE'),
    needsMigration: instance.items?.[0]?.item && !instance.items[0].item.title
  });

  // Check if instance needs migration (old data structure)
  if (instance.items && instance.items.length > 0) {
    const needsMigration = instance.items.some(item => 
      !item.item || 
      !item.item.title || 
      item.item.title === 'Untitled Item' ||
      !item.item.item_type ||
      typeof item.item.is_required !== 'boolean'
    );

    if (needsMigration) {
      console.log('🔄 Migrating instance with old data structure:', id);
      
      // Migrate items to new structure
      instance.items = instance.items.map(item => {
        if (!item.item || !item.item.title) {
          // Create new item structure based on old data
          const newItem = {
            id: item.id,
            title: 'System Status Check', // Default title
            description: 'Verify all systems are operational',
            item_type: 'ROUTINE',
            is_required: true,
            scheduled_time: null,
            severity: 1,
            sort_order: item.sort_order || 1
          };
          
          return {
            ...item,
            item: newItem
          };
        }
        
        // Ensure all required properties exist
        return {
          ...item,
          item: {
            ...item.item,
            item_type: item.item.item_type || 'ROUTINE',
            is_required: typeof item.item.is_required === 'boolean' ? item.item.is_required : !!item.item.required,
            scheduled_time: item.item.scheduled_time || null,
            severity: item.item.severity || 1
          }
        };
      });

      console.log('✅ Instance migrated successfully:', {
        instanceId: id,
        newItemsCount: instance.items.length,
        firstItemTitle: instance.items[0]?.item?.title,
        allItemTitles: instance.items.map(item => item.item?.title || 'NO TITLE')
      });
    }
  }

  // Check and update status based on current time
  const now = new Date();
  const startTime = new Date(instance.shift_start);
  const endTime = new Date(instance.shift_end);
  const currentStatus = instance.status;
  
  // Only update if not already in a final state
  if (currentStatus !== 'COMPLETED' && currentStatus !== 'COMPLETED_WITH_EXCEPTIONS') {
    let newStatus = currentStatus;
    
    if (now >= endTime) {
      newStatus = 'PENDING_REVIEW';
    } else if (now >= startTime) {
      newStatus = 'IN_PROGRESS';
    }
    
    if (newStatus !== currentStatus) {
      instance.status = newStatus;
      instance.updated_at = now.toISOString();
      logger.info('Instance status updated on retrieval', {
        instanceId: id,
        oldStatus: currentStatus,
        newStatus,
        currentTime: now.toISOString(),
        shiftStart: startTime.toISOString(),
        shiftEnd: endTime.toISOString()
      });
    }
  }

  res.json(instance);
});

app.post('/api/v1/checklists/instances/:instanceId/join', (req, res) => {
  const { instanceId } = req.params;
  const instance = checklistInstances.get(instanceId);
  
  if (!instance) {
    return res.status(404).json({ error: 'Checklist instance not found' });
  }

  // Check if instance is still open for joining
  if (instance.status !== 'OPEN' && instance.status !== 'IN_PROGRESS') {
    return res.status(400).json({ 
      error: 'Cannot join checklist instance that is not open or in progress',
      status: instance.status 
    });
  }

  // Extract user from request - in production, this would come from JWT token middleware
  // For now, we'll extract from Authorization header or use mock data
  let joiningUser;
  
  // Try to get user from Authorization header (if JWT middleware is implemented)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // In production, you would verify the JWT token and extract user info
    // For now, we'll simulate the user details you provided
    joiningUser = {
      id: '785cfda9-38c7-4b8d-844a-5c8c7672a12b',
      username: 'ashumba',
      email: 'ashumba@afcholdings.co.zw',
      role: 'admin'
    };
  } else {
    // Fallback to mock user data for development
    joiningUser = {
      id: '785cfda9-38c7-4b8d-844a-5c8c7672a12b',
      username: 'ashumba',
      email: 'ashumba@afcholdings.co.zw',
      role: 'admin'
    };
  }

  // Log the joining user details for debugging
  console.log('🔐 User attempting to join checklist:', {
    id: joiningUser.id,
    username: joiningUser.username,
    email: joiningUser.email,
    role: joiningUser.role
  });

  // Check if user is already a participant
  const existingParticipant = instance.participants.find(p => p.id === joiningUser.id);
  if (existingParticipant) {
    logger.info('User already joined instance', { 
      instanceId, 
      userId: joiningUser.id,
      username: joiningUser.username 
    });
    return res.json(instance);
  }

  // Add user to participants with proper structure
  const newParticipant = {
    id: joiningUser.id,
    username: joiningUser.username,
    email: joiningUser.email,
    role: joiningUser.role
  };

  instance.participants.push(newParticipant);
  
  // Update instance status to IN_PROGRESS if this is the first participant
  if (instance.participants.length === 1) {
    instance.status = 'IN_PROGRESS';
    logger.info('Instance status updated to IN_PROGRESS', { instanceId });
  }

  // Set created_by if not already set (first participant becomes creator)
  if (!instance.created_by && instance.participants.length === 1) {
    instance.created_by = {
      id: joiningUser.id,
      username: joiningUser.username,
      email: joiningUser.email
    };
  }

  logger.info('User joined checklist instance successfully', {
    instanceId,
    user: {
      id: joiningUser.id,
      username: joiningUser.username,
      email: joiningUser.email,
      role: joiningUser.role
    },
    totalParticipants: instance.participants.length,
    instanceStatus: instance.status,
    timestamp: new Date().toISOString()
  });

  // Return the updated instance with participant information
  res.json(instance);
});

app.patch('/api/v1/checklists/instances/:instanceId/items/:itemId', (req, res) => {
  const { instanceId, itemId } = req.params;
  const { status, notes } = req.body;
  
  const instance = checklistInstances.get(instanceId);
  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }
  
  const item = instance.items.find(item => item.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  // Log the update attempt
  console.log('🔄 Updating item status:', {
    instanceId,
    itemId,
    currentStatus: item.status,
    newStatus: status,
    notes: notes
  });
  
  // Update item fields
  item.status = status;
  item.notes = notes || null;
  item.updated_at = new Date().toISOString();
  
  // If item is being started and instance is OPEN, set instance to IN_PROGRESS
  if (status === 'IN_PROGRESS' && instance.status === 'OPEN') {
    instance.status = 'IN_PROGRESS';
    logger.info('Instance status auto-updated to IN_PROGRESS on item start', { 
      instanceId, 
      itemId,
      user: item.completed_by?.username 
    });
  }
  
  // Set completion details if status is COMPLETED
  if (status === 'COMPLETED') {
    item.completed_at = new Date().toISOString();
    // Mock user who completed the item - in production, this would come from auth
    item.completed_by = {
      id: '785cfda9-38c7-4b8d-844a-5c8c7672a12b',
      username: 'ashumba'
    };
    console.log('✅ Item marked as completed:', {
      itemId,
      completedBy: item.completed_by,
      completedAt: item.completed_at
    });
  }
  
  // Update instance timestamp
  instance.updated_at = new Date().toISOString();
  
  logger.info('Updated item status successfully', { 
    instanceId, 
    itemId, 
    status, 
    completedBy: item.completed_by?.username,
    completedAt: item.completed_at
  });
  
  // Return the updated item with proper structure
  res.json(item);
});

// Complete checklist instance endpoint
app.post('/api/v1/checklists/instances/:instanceId/complete', (req, res) => {
  const { instanceId } = req.params;
  const { with_exceptions } = req.query;
  
  const instance = checklistInstances.get(instanceId);
  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }
  
  // Check if instance can be completed (must be IN_PROGRESS or PENDING_REVIEW)
  if (instance.status !== 'IN_PROGRESS' && instance.status !== 'PENDING_REVIEW' && instance.status !== 'OPEN') {
    return res.status(400).json({ 
      error: 'Cannot complete checklist instance that is not active',
      status: instance.status 
    });
  }
  
  const now = new Date();
  
  // Check if all items are completed
  const allItemsCompleted = instance.items.every(item => item.status === 'COMPLETED');
  const hasExceptions = instance.items.some(item => item.status !== 'COMPLETED');
  
  // Determine final status based on with_exceptions flag and item statuses
  let finalStatus;
  if (with_exceptions === 'true' && hasExceptions) {
    finalStatus = 'COMPLETED_WITH_EXCEPTIONS';
  } else if (allItemsCompleted) {
    finalStatus = 'COMPLETED';
  } else if (with_exceptions === 'true') {
    finalStatus = 'COMPLETED_WITH_EXCEPTIONS';
  } else {
    // If not all items completed and no exceptions flag, reject completion
    return res.status(400).json({
      error: 'Cannot complete checklist with incomplete items. Use with_exceptions=true to complete with exceptions.',
      incompleteItems: instance.items.filter(item => item.status !== 'COMPLETED').length
    });
  }
  
  // Update instance status
  instance.status = finalStatus;
  instance.closed_at = now.toISOString();
  instance.updated_at = now.toISOString();
  
  // Set closed_by (mock user for now)
  instance.closed_by = {
    id: '785cfda9-38c7-4b8d-844a-5c8c7672a12b',
    username: 'ashumba',
    email: 'ashumba@sentinel.ops'
  };
  
  logger.info('Checklist instance completed', {
    instanceId,
    finalStatus,
    allItemsCompleted,
    hasExceptions,
    totalItems: instance.items.length,
    completedItems: instance.items.filter(item => item.status === 'COMPLETED').length
  });
  
  res.json(instance);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    instances: checklistInstances.size,
    templates: templates.size
  });
});

// Initialize on startup
async function initialize() {
  logger.info('Starting SentinelOps Backend Service');
  
  initializeTemplates();
  
  // Check for existing instances on startup
  await ensureDailyInstances();
  await updateInstanceStatuses();
  
  logger.info('Backend service initialized successfully');
}

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  initialize();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});
