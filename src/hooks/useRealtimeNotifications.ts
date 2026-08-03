import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthUser, isDevLevel } from '@/types/auth';
import { NotificationAlert } from '@/types/notifications';

interface UnreadCount {
  groupNotifications: number;
  userNotifications: number;
  ticketMessages: number;
  total: number;
}

export const useRealtimeNotifications = (user: AuthUser | null) => {
  const [unreadCount, setUnreadCount] = useState<UnreadCount>({
    groupNotifications: 0,
    userNotifications: 0,
    ticketMessages: 0,
    total: 0,
  });
  const [newAlerts, setNewAlerts] = useState<NotificationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track dismissed alerts to prevent them from reappearing
  const dismissedAlertIds = useRef<Set<string>>(new Set());

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id || !user?.role) return;

    try {
      // Get all group notifications visible to user's role
      const { data: groupNotifications } = await supabase
        .from('notifications')
        .select('id')
        .contains('visible_to_roles', [user.role]);

      // Get read group notifications
      const { data: readGroupNotifications } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
        .not('notification_id', 'is', null);

      const readGroupIds = new Set(readGroupNotifications?.map(r => r.notification_id) || []);
      const unreadGroupCount = groupNotifications?.filter(n => !readGroupIds.has(n.id)).length || 0;

      // Get user-specific notifications
      const { data: userNotifications } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('target_user_id', user.id);

      // Get read user notifications
      const { data: readUserNotifications } = await supabase
        .from('notification_reads')
        .select('user_notification_id')
        .eq('user_id', user.id)
        .not('user_notification_id', 'is', null);

      const readUserIds = new Set(readUserNotifications?.map(r => r.user_notification_id) || []);
      const unreadUserCount = userNotifications?.filter(n => !readUserIds.has(n.id)).length || 0;

      // Get unread ticket messages only from OPEN tickets
      let unreadTicketMessages = 0;
      const hasFullAccess = isDevLevel(user.role) || user.role === 'admin';
      
      if (hasFullAccess) {
        // Admin/Dev sees messages from users on open tickets only
        const { data: openTickets } = await supabase
          .from('tickets')
          .select('id')
          .in('status', ['aberto', 'em_andamento']);
        
        if (openTickets && openTickets.length > 0) {
          const openTicketIds = openTickets.map(t => t.id);
          const { data: ticketMessages } = await supabase
            .from('ticket_messages')
            .select('id')
            .in('ticket_id', openTicketIds)
            .eq('is_admin_reply', false);
          unreadTicketMessages = ticketMessages?.length || 0;
        }
      } else {
        // Users see admin replies on their OPEN tickets only
        const { data: userOpenTickets } = await supabase
          .from('tickets')
          .select('id')
          .eq('user_id', user.id)
          .in('status', ['aberto', 'em_andamento']);
        
        if (userOpenTickets && userOpenTickets.length > 0) {
          const ticketIds = userOpenTickets.map(t => t.id);
          const { data: ticketMessages } = await supabase
            .from('ticket_messages')
            .select('id')
            .in('ticket_id', ticketIds)
            .eq('is_admin_reply', true);
          unreadTicketMessages = ticketMessages?.length || 0;
        }
      }

      setUnreadCount({
        groupNotifications: unreadGroupCount,
        userNotifications: unreadUserCount,
        ticketMessages: unreadTicketMessages,
        total: unreadGroupCount + unreadUserCount,
      });
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  const addNewAlert = useCallback((notification: NotificationAlert) => {
    // Don't add if already dismissed
    if (dismissedAlertIds.current.has(notification.id)) return;
    
    setNewAlerts(prev => {
      // Avoid duplicates
      if (prev.some(a => a.id === notification.id)) return prev;
      return [...prev, notification];
    });
  }, []);

  const dismissAlert = useCallback((id: string) => {
    // Mark as dismissed so it won't reappear
    dismissedAlertIds.current.add(id);
    setNewAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const dismissAllAlerts = useCallback(() => {
    // Mark all current alerts as dismissed
    newAlerts.forEach(alert => dismissedAlertIds.current.add(alert.id));
    setNewAlerts([]);
  }, [newAlerts]);

  // Remove alerts for resolved tickets
  const removeTicketAlerts = useCallback((ticketId: string) => {
    setNewAlerts(prev => {
      const alertsToRemove = prev.filter(a => a.ticketId === ticketId);
      alertsToRemove.forEach(a => dismissedAlertIds.current.add(a.id));
      return prev.filter(a => a.ticketId !== ticketId);
    });
  }, []);

  const markAllAsRead = async () => {
    if (!user?.id || !user?.role) return;

    try {
      // Get all unread group notifications
      const { data: groupNotifications } = await supabase
        .from('notifications')
        .select('id')
        .contains('visible_to_roles', [user.role]);

      const { data: readGroupNotifications } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
        .not('notification_id', 'is', null);

      const readGroupIds = new Set(readGroupNotifications?.map(r => r.notification_id) || []);
      const unreadGroupNotifications = groupNotifications?.filter(n => !readGroupIds.has(n.id)) || [];

      // Get all unread user notifications
      const { data: userNotifications } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('target_user_id', user.id);

      const { data: readUserNotifications } = await supabase
        .from('notification_reads')
        .select('user_notification_id')
        .eq('user_id', user.id)
        .not('user_notification_id', 'is', null);

      const readUserIds = new Set(readUserNotifications?.map(r => r.user_notification_id) || []);
      const unreadUserNotifications = userNotifications?.filter(n => !readUserIds.has(n.id)) || [];

      // Insert read records for group notifications
      if (unreadGroupNotifications.length > 0) {
        const groupReads = unreadGroupNotifications.map(n => ({
          user_id: user.id,
          notification_id: n.id,
        }));
        await supabase.from('notification_reads').insert(groupReads);
      }

      // Insert read records for user notifications
      if (unreadUserNotifications.length > 0) {
        const userReads = unreadUserNotifications.map(n => ({
          user_id: user.id,
          user_notification_id: n.id,
        }));
        await supabase.from('notification_reads').insert(userReads);
      }

      setUnreadCount(prev => ({ 
        ...prev, 
        groupNotifications: 0, 
        userNotifications: 0,
        total: 0 
      }));
      
      // Dismiss notification alerts (not ticket alerts)
      setNewAlerts(prev => {
        const notificationAlerts = prev.filter(a => a.type !== 'ticket_message');
        notificationAlerts.forEach(a => dismissedAlertIds.current.add(a.id));
        return prev.filter(a => a.type === 'ticket_message');
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  // Setup realtime subscriptions
  useEffect(() => {
    if (!user?.id || !user?.role) return;

    // Subscribe to new group notifications
    const notificationsChannel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif.visible_to_roles?.includes(user.role)) {
            addNewAlert({
              id: newNotif.id,
              type: 'notification',
              title: newNotif.title,
              message: newNotif.message,
              createdAt: newNotif.created_at,
              image_url: newNotif.image_url,
              image_path: newNotif.image_path,
            });
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    // Subscribe to user-specific notifications
    const userNotificationsChannel = supabase
      .channel('user-notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
        },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif.target_user_id === user.id) {
            addNewAlert({
              id: newNotif.id,
              type: 'user_notification',
              title: newNotif.title,
              message: newNotif.message,
              createdAt: newNotif.created_at,
              image_url: newNotif.image_url,
              image_path: newNotif.image_path,
            });
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    // Subscribe to ticket messages
    const ticketMessagesChannel = supabase
      .channel('ticket-messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Check ticket status first
          const { data: ticket } = await supabase
            .from('tickets')
            .select('title, user_id, status')
            .eq('id', newMessage.ticket_id)
            .single();
          
          // Only show alerts for open/in_progress tickets
          if (!ticket || ticket.status === 'resolvido' || ticket.status === 'fechado') {
            return;
          }
          
          const hasFullAccess = isDevLevel(user.role) || user.role === 'admin';
          
          // If admin/dev and message is from user, show alert
          if (hasFullAccess && !newMessage.is_admin_reply) {
            addNewAlert({
              id: newMessage.id,
              type: 'ticket_message',
              title: 'Nova mensagem em ticket',
              message: ticket.title || 'Novo chamado recebeu uma mensagem',
              createdAt: newMessage.created_at,
              ticketId: newMessage.ticket_id,
            });
            fetchUnreadCount();
          }
          
          // If user and message is from admin (and it's their ticket)
          if (!hasFullAccess && newMessage.is_admin_reply) {
            if (ticket.user_id === user.id) {
              addNewAlert({
                id: newMessage.id,
                type: 'ticket_message',
                title: 'Resposta do suporte',
                message: ticket.title || 'Seu chamado recebeu uma resposta',
                createdAt: newMessage.created_at,
                ticketId: newMessage.ticket_id,
              });
              fetchUnreadCount();
            }
          }
        }
      )
      .subscribe();

    // Subscribe to new tickets (for admins)
    const newTicketsChannel = supabase
      .channel('new-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets',
        },
        async (payload) => {
          const newTicket = payload.new as any;
          const hasFullAccess = isDevLevel(user.role) || user.role === 'admin';
          
          // Only admins/devs should receive new ticket alerts
          if (hasFullAccess && newTicket.user_id !== user.id) {
            // Get the user name who created the ticket
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newTicket.user_id)
              .single();
            
            addNewAlert({
              id: `ticket-${newTicket.id}`,
              type: 'new_ticket',
              title: 'Novo chamado aberto',
              message: `${profile?.full_name || 'Usuário'}: ${newTicket.title}`,
              createdAt: newTicket.created_at,
              ticketId: newTicket.id,
            });
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    // Subscribe to ticket status changes to remove alerts when resolved
    const ticketStatusChannel = supabase
      .channel('ticket-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          const updatedTicket = payload.new as any;
          // If ticket is resolved or closed, remove its alerts
          if (updatedTicket.status === 'resolvido' || updatedTicket.status === 'fechado') {
            removeTicketAlerts(updatedTicket.id);
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(userNotificationsChannel);
      supabase.removeChannel(ticketMessagesChannel);
      supabase.removeChannel(newTicketsChannel);
      supabase.removeChannel(ticketStatusChannel);
    };
  }, [user?.id, user?.role, addNewAlert, fetchUnreadCount, removeTicketAlerts]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    newAlerts,
    loading,
    markAllAsRead,
    dismissAlert,
    dismissAllAlerts,
    refetch: fetchUnreadCount,
  };
};
