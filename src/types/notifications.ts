import { AppRole } from '@/types/auth';

export interface NotificationMediaFields {
  image_url?: string | null;
  image_path?: string | null;
}

export interface NotificationAlert extends NotificationMediaFields {
  id: string;
  type: 'notification' | 'user_notification' | 'ticket_message' | 'new_ticket';
  title: string;
  message: string;
  createdAt: string;
  ticketId?: string;
}

export interface UserNotificationRecord extends NotificationMediaFields {
  id: string;
  title: string;
  message: string;
  created_at: string;
  target_user_id: string;
}

export interface GroupNotificationRecord extends NotificationMediaFields {
  id: string;
  title: string;
  message: string;
  visible_to_roles: AppRole[];
  created_by: string | null;
  created_at: string;
}