import type {
  ChecklistItem,
  ChecklistScheduledEvent,
  CreateTemplateItemRequest,
  CreateTemplateSubitemRequest,
} from '../../services/checklistApi';

export type ChecklistItemType =
  | 'ROUTINE'
  | 'TIMED'
  | 'SCHEDULED_EVENT'
  | 'CONDITIONAL'
  | 'INFORMATIONAL';

export interface ScheduledEventForm {
  id: string;
  event_datetime: string;
  notify_before_minutes: number | '';
  notify_all: boolean;
}

export interface SubitemForm {
  id: string;
  title: string;
  description: string;
  item_type: ChecklistItemType;
  is_required: boolean;
  has_exe_time: boolean;
  severity: number;
  sort_order: number;
  scheduled_time: string;
  notify_before_minutes: number | '';
}

export interface ItemForm extends Omit<SubitemForm, 'notify_before_minutes'> {
  notify_before_minutes: number | '';
  subitems: SubitemForm[];
  scheduled_events: ScheduledEventForm[];
  expanded: boolean;
}

export const ITEM_TYPE_OPTIONS: ChecklistItemType[] = [
  'ROUTINE',
  'TIMED',
  'SCHEDULED_EVENT',
  'CONDITIONAL',
  'INFORMATIONAL',
];

export const createFormId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeOptionalText = (value?: string | null) => (value || '').trim();

export const toNumberOrBlank = (value?: number | null): number | '' =>
  typeof value === 'number' ? value : '';

export const normalizeScheduledTimeForType = (
  itemType: ChecklistItemType,
  scheduledTime?: string | null
) => {
  if (itemType !== 'TIMED') {
    return '';
  }
  return scheduledTime || '';
};

export const normalizeNotifyMinutesForType = (
  itemType: ChecklistItemType,
  notifyBeforeMinutes?: number | null
) => {
  if (itemType !== 'TIMED') {
    return '';
  }
  return toNumberOrBlank(notifyBeforeMinutes);
};

export const createEmptyScheduledEvent = (seed?: Partial<ScheduledEventForm>): ScheduledEventForm => ({
  id: seed?.id || createFormId(),
  event_datetime: seed?.event_datetime || '',
  notify_before_minutes: seed?.notify_before_minutes ?? 30,
  notify_all: seed?.notify_all ?? true,
});

export const createEmptySubitem = (sortOrder: number): SubitemForm => ({
  id: createFormId(),
  title: '',
  description: '',
  item_type: 'ROUTINE',
  is_required: false,
  has_exe_time: false,
  severity: 1,
  sort_order: sortOrder,
  scheduled_time: '',
  notify_before_minutes: '',
});

export const createEmptyItem = (sortOrder: number): ItemForm => ({
  id: createFormId(),
  title: '',
  description: '',
  item_type: 'ROUTINE',
  is_required: true,
  has_exe_time: false,
  severity: 1,
  sort_order: sortOrder,
  scheduled_time: '',
  notify_before_minutes: '',
  subitems: [],
  scheduled_events: [],
  expanded: true,
});

export const normalizeSubitems = (subitems: SubitemForm[]) =>
  subitems.map((subitem, index) => ({
    ...subitem,
    sort_order: index,
  }));

export const normalizeItems = (items: ItemForm[]) =>
  items.map((item, index) => ({
    ...item,
    sort_order: index,
    subitems: normalizeSubitems(item.subitems),
  }));

export const applyItemTypeRules = (item: ItemForm): ItemForm => {
  if (item.item_type === 'TIMED') {
    return item;
  }

  if (item.item_type === 'SCHEDULED_EVENT') {
    return {
      ...item,
      scheduled_time: '',
      notify_before_minutes: '',
      scheduled_events: item.scheduled_events.length > 0 ? item.scheduled_events : [createEmptyScheduledEvent()],
    };
  }

  return {
    ...item,
    scheduled_time: '',
    notify_before_minutes: '',
    scheduled_events: [],
  };
};

export const applySubitemTypeRules = (subitem: SubitemForm): SubitemForm => {
  if (subitem.item_type === 'TIMED') {
    return subitem;
  }

  return {
    ...subitem,
    scheduled_time: '',
    notify_before_minutes: '',
  };
};

export const createScheduledEventPayload = (
  event: ScheduledEventForm
): ChecklistScheduledEvent | null => {
  if (!event.event_datetime) {
    return null;
  }

  return {
    event_datetime: event.event_datetime,
    notify_before_minutes:
      typeof event.notify_before_minutes === 'number' ? event.notify_before_minutes : 30,
    notify_all: event.notify_all,
    notify_roles: null,
  };
};

export const serializeSubitemForRequest = (
  subitem: SubitemForm
): CreateTemplateSubitemRequest => ({
  id: subitem.id,
  title: subitem.title.trim(),
  description: normalizeOptionalText(subitem.description),
  item_type: subitem.item_type,
  is_required: subitem.is_required,
  has_exe_time: subitem.has_exe_time,
  scheduled_time: subitem.item_type === 'TIMED' ? subitem.scheduled_time || null : null,
  notify_before_minutes:
    subitem.item_type === 'TIMED' && typeof subitem.notify_before_minutes === 'number'
      ? subitem.notify_before_minutes
      : null,
  severity: subitem.severity,
  sort_order: subitem.sort_order,
});

export const serializeItemForRequest = (
  item: ItemForm
): CreateTemplateItemRequest => ({
  id: item.id,
  title: item.title.trim(),
  description: normalizeOptionalText(item.description),
  item_type: item.item_type,
  is_required: item.is_required,
  has_exe_time: item.has_exe_time,
  scheduled_time: item.item_type === 'TIMED' ? item.scheduled_time || null : null,
  notify_before_minutes:
    item.item_type === 'TIMED' && typeof item.notify_before_minutes === 'number'
      ? item.notify_before_minutes
      : null,
  severity: item.severity,
  sort_order: item.sort_order,
  subitems: normalizeSubitems(item.subitems).map(serializeSubitemForRequest),
  scheduled_events:
    item.item_type === 'SCHEDULED_EVENT'
      ? item.scheduled_events
          .map(createScheduledEventPayload)
          .filter((event): event is ChecklistScheduledEvent => Boolean(event))
      : [],
});

export const mapTemplateItemToForm = (item: ChecklistItem): ItemForm =>
  applyItemTypeRules({
    id: item.id,
    title: item.title,
    description: item.description || '',
    item_type: item.item_type,
    is_required: item.is_required,
    has_exe_time: item.has_exe_time ?? false,
    severity: item.severity,
    sort_order: item.sort_order,
    scheduled_time: normalizeScheduledTimeForType(item.item_type, item.scheduled_time),
    notify_before_minutes: normalizeNotifyMinutesForType(item.item_type, item.notify_before_minutes),
    subitems: normalizeSubitems(
      (item.subitems || []).map((subitem) =>
        applySubitemTypeRules({
          id: subitem.id,
          title: subitem.title,
          description: subitem.description || '',
          item_type: subitem.item_type,
          is_required: subitem.is_required,
          has_exe_time: subitem.has_exe_time ?? false,
          severity: subitem.severity,
          sort_order: subitem.sort_order,
          scheduled_time: normalizeScheduledTimeForType(subitem.item_type, subitem.scheduled_time),
          notify_before_minutes: normalizeNotifyMinutesForType(
            subitem.item_type,
            subitem.notify_before_minutes
          ),
        })
      )
    ),
    scheduled_events: (item.scheduled_events || []).map((event) =>
      createEmptyScheduledEvent({
        id: event.id || createFormId(),
        event_datetime: event.event_datetime,
        notify_before_minutes: event.notify_before_minutes,
        notify_all: event.notify_all,
      })
    ),
    expanded: true,
  });

export const getItemTypeHint = (itemType: ChecklistItemType) => {
  switch (itemType) {
    case 'TIMED':
      return 'Timed items use a daily scheduled time and reminder window.';
    case 'SCHEDULED_EVENT':
      return 'Scheduled-event items track one or more explicit event timestamps.';
    case 'CONDITIONAL':
      return 'Conditional items remain manual-only in this release.';
    case 'INFORMATIONAL':
      return 'Informational items provide operator context without execution timing.';
    default:
      return 'Routine items are standard checklist actions.';
  }
};
