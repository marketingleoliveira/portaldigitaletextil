import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, TicketIcon, X, ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NotificationAlert } from '@/types/notifications';

interface PersistentNotificationAlertProps {
  alerts: NotificationAlert[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

const PersistentNotificationAlert: React.FC<PersistentNotificationAlertProps> = ({
  alerts,
  onDismiss,
  onDismissAll,
}) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);

  useEffect(() => {
    if (alerts.length > 0) {
      setIsVisible(true);
    }
  }, [alerts.length]);

  if (alerts.length === 0 || !isVisible) return null;

  const currentAlert = alerts[currentAlertIndex % alerts.length];

  const handleAction = () => {
    if ((currentAlert.type === 'ticket_message' || currentAlert.type === 'new_ticket') && currentAlert.ticketId) {
      navigate(`/tickets/${currentAlert.ticketId}`);
    } else {
      navigate('/notificacoes');
    }
    onDismiss(currentAlert.id);
    
    if (alerts.length === 1) {
      setIsVisible(false);
    } else {
      setCurrentAlertIndex(prev => (prev + 1) % (alerts.length - 1));
    }
  };

  const handleDismissThis = () => {
    onDismiss(currentAlert.id);
    if (alerts.length === 1) {
      setIsVisible(false);
    }
  };

  const getIcon = () => {
    switch (currentAlert.type) {
      case 'ticket_message':
      case 'new_ticket':
        return <TicketIcon className="w-8 h-8" />;
      case 'user_notification':
        return <MessageCircle className="w-8 h-8" />;
      default:
        return <Bell className="w-8 h-8" />;
    }
  };

  const getActionText = () => {
    switch (currentAlert.type) {
      case 'ticket_message':
        return 'Ver Ticket';
      case 'new_ticket':
        return 'Ver Chamado';
      default:
        return 'Ver Notificação';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[100] animate-fade-in" />
      
      {/* Alert Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full animate-scale-in overflow-hidden">
          {/* Header with pulse animation */}
          <div className="bg-gradient-to-r from-primary via-primary/80 to-primary p-6 text-primary-foreground relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 animate-pulse" />
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-full animate-bounce">
                {getIcon()}
              </div>
              <div className="flex-1">
                <p className="text-sm opacity-80">Nova Notificação</p>
                <h3 className="text-xl font-bold">{currentAlert.title}</h3>
              </div>
              {alerts.length > 1 && (
                <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                  {currentAlertIndex + 1}/{alerts.length}
                </div>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            {currentAlert.image_url && (
              <div className="mb-4 overflow-hidden rounded-xl border border-border bg-muted/30">
                <img
                  src={currentAlert.image_url}
                  alt={currentAlert.title}
                  className="h-56 w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <p className="text-foreground text-lg mb-6 line-clamp-3">
              {currentAlert.message}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleAction}
                className="flex-1 h-12 text-base gap-2"
              >
                {getActionText()}
                <ArrowRight className="w-5 h-5" />
              </Button>
              
              <Button
                variant="outline"
                onClick={handleDismissThis}
                className="h-12"
              >
                Dispensar
              </Button>
            </div>
            
            {alerts.length > 1 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    +{alerts.length - 1} {alerts.length === 2 ? 'outra notificação' : 'outras notificações'}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentAlertIndex(prev => 
                        prev === 0 ? alerts.length - 1 : prev - 1
                      )}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentAlertIndex(prev => 
                        (prev + 1) % alerts.length
                      )}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
                <Button
                  variant="link"
                  className="w-full mt-2 text-muted-foreground"
                  onClick={() => {
                    onDismissAll();
                    setIsVisible(false);
                  }}
                >
                  Dispensar todas
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PersistentNotificationAlert;
