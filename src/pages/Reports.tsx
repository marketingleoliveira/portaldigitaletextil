import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { AccessLog, AppRole, isManagerOrAbove } from '@/types/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3, Users, Activity, TrendingUp, Loader2, 
  User, Download, LogIn, FileText, ChevronLeft, Calendar,
  Clock, Globe, Timer, Trash2, Pencil, Save, X, LogOut, AlertTriangle, Receipt
} from 'lucide-react';
import ReembolsosManager from '@/components/reembolsos/ReembolsosManager';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import RoleBadge from '@/components/RoleBadge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import UserActivityReport from '@/components/UserActivityReport';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { hasFullAccess } from '@/types/auth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  role?: AppRole;
  last_login?: string;
  total_logins: number;
  total_downloads: number;
}

interface UserActivity {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
  resource_name?: string;
  ip_address?: string | null;
}

interface TimeRecord {
  id: string;
  record_date: string;
  entry_time: string | null;
  lunch_exit_time: string | null;
  lunch_return_time: string | null;
  exit_time: string | null;
}

interface EditingTimeRecord {
  id: string;
  record_date: string;
  entry_time: string;
  lunch_exit_time: string;
  lunch_return_time: string;
  exit_time: string;
}

const Reports: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTimeRecords, setShowTimeRecords] = useState(false);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [loadingTimeRecords, setLoadingTimeRecords] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EditingTimeRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showActivityReport, setShowActivityReport] = useState(false);
  const [showReembolsos, setShowReembolsos] = useState(false);
  const [forceLogoutLoading, setForceLogoutLoading] = useState(false);
  const [stats, setStats] = useState({
    totalLogins: 0,
    uniqueUsers: 0,
    todayLogins: 0,
  });

  useEffect(() => {
    if (isManagerOrAbove(user?.role)) {
      fetchUsers();
      fetchOverallStats();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch access logs for stats
      const { data: logs, error: logsError } = await supabase
        .from('access_logs')
        .select('user_id, action, created_at');

      if (logsError) throw logsError;

      // Map users with their stats
      const usersWithStats = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        const userLogs = logs?.filter((l) => l.user_id === profile.id) || [];
        const loginLogs = userLogs.filter((l) => l.action === 'login');
        const downloadLogs = userLogs.filter((l) => l.action === 'download');
        const lastLogin = loginLogs.length > 0 
          ? loginLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at
          : null;

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          is_active: profile.is_active,
          role: userRole?.role as AppRole | undefined,
          last_login: lastLogin || undefined,
          total_logins: loginLogs.length,
          total_downloads: downloadLogs.length,
        };
      });

      setUsers(usersWithStats);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverallStats = async () => {
    try {
      const { data, error } = await supabase
        .from('access_logs')
        .select('user_id, action, created_at')
        .eq('action', 'login');

      if (error) throw error;

      const logsData = data || [];
      const today = new Date().toDateString();
      const todayLogins = logsData.filter(
        (log) => new Date(log.created_at).toDateString() === today
      ).length;
      const uniqueUsers = new Set(logsData.map((log) => log.user_id)).size;

      setStats({
        totalLogins: logsData.length,
        uniqueUsers,
        todayLogins,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUserActivities = async (userId: string) => {
    setLoadingActivities(true);
    try {
      const { data: logs, error } = await supabase
        .from('access_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Enhance logs with resource names
      const enhancedLogs = await Promise.all(
        (logs || []).map(async (log) => {
          let resourceName = '';
          
          if (log.resource_type === 'file' && log.resource_id) {
            const { data: file } = await supabase
              .from('files')
              .select('name')
              .eq('id', log.resource_id)
              .maybeSingle();
            resourceName = file?.name || 'Arquivo removido';
          } else if (log.resource_type === 'product' && log.resource_id) {
            const { data: product } = await supabase
              .from('products')
              .select('name')
              .eq('id', log.resource_id)
              .maybeSingle();
            resourceName = product?.name || 'Produto removido';
          }

          return {
            ...log,
            resource_name: resourceName,
            ip_address: log.ip_address,
          };
        })
      );

      setUserActivities(enhancedLogs);
    } catch (error) {
      console.error('Error fetching user activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleSelectUser = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setShowTimeRecords(false);
    setTimeRecords([]);
    fetchUserActivities(userProfile.id);
  };

  const fetchTimeRecords = async (userId: string) => {
    setLoadingTimeRecords(true);
    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', userId)
        .order('record_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setTimeRecords(data || []);
      setShowTimeRecords(true);
    } catch (error) {
      console.error('Error fetching time records:', error);
    } finally {
      setLoadingTimeRecords(false);
    }
  };

  const downloadTimeRecordsCSV = async (userId: string, userName: string) => {
    try {
      // Fetch ALL time records for this user
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', userId)
        .order('record_date', { ascending: true });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        alert('Nenhum registro de ponto encontrado para este usuário.');
        return;
      }

      // Create CSV content
      const headers = ['Data', 'Entrada', 'Saída Almoço', 'Retorno Almoço', 'Saída'];
      const rows = data.map(record => [
        format(new Date(record.record_date + 'T00:00:00'), 'dd/MM/yyyy'),
        record.entry_time ? format(new Date(record.entry_time), 'HH:mm') : '',
        record.lunch_exit_time ? format(new Date(record.lunch_exit_time), 'HH:mm') : '',
        record.lunch_return_time ? format(new Date(record.lunch_return_time), 'HH:mm') : '',
        record.exit_time ? format(new Date(record.exit_time), 'HH:mm') : '',
      ]);

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');

      // Add BOM for Excel compatibility with special characters
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ponto_${userName.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading time records:', error);
      alert('Erro ao gerar arquivo de ponto.');
    }
  };

  const calculateWorkedHours = (record: TimeRecord): { morning: string; afternoon: string; total: string } => {
    let morningMinutes = 0;
    let afternoonMinutes = 0;

    // Morning: entry_time to lunch_exit_time
    if (record.entry_time && record.lunch_exit_time) {
      const entry = new Date(record.entry_time);
      const lunchExit = new Date(record.lunch_exit_time);
      morningMinutes = Math.max(0, (lunchExit.getTime() - entry.getTime()) / 60000);
    }

    // Afternoon: lunch_return_time to exit_time
    if (record.lunch_return_time && record.exit_time) {
      const lunchReturn = new Date(record.lunch_return_time);
      const exit = new Date(record.exit_time);
      afternoonMinutes = Math.max(0, (exit.getTime() - lunchReturn.getTime()) / 60000);
    }

    const totalMinutes = morningMinutes + afternoonMinutes;

    const formatMinutesToHours = (mins: number) => {
      const hours = Math.floor(mins / 60);
      const minutes = Math.round(mins % 60);
      return `${hours}h${minutes.toString().padStart(2, '0')}min`;
    };

    return {
      morning: morningMinutes > 0 ? formatMinutesToHours(morningMinutes) : '-',
      afternoon: afternoonMinutes > 0 ? formatMinutesToHours(afternoonMinutes) : '-',
      total: totalMinutes > 0 ? formatMinutesToHours(totalMinutes) : '-',
    };
  };

  const downloadTimeRecordsPDF = async (userId: string, userName: string) => {
    try {
      // Fetch ALL time records for this user
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', userId)
        .order('record_date', { ascending: true });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        alert('Nenhum registro de ponto encontrado para este usuário.');
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;

      // Load logo image
      const loadImage = (src: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
          img.src = src;
        });
      };

      // Try to add logo
      try {
        const logoUrl = (await import('@/assets/logo-digitale-full.png')).default;
        const logoBase64 = await loadImage(logoUrl);
        const logoWidth = 50;
        const logoHeight = 15;
        doc.addImage(logoBase64, 'PNG', margin, 10, logoWidth, logoHeight);
      } catch (logoError) {
        console.warn('Could not load logo:', logoError);
      }

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE PONTO', pageWidth / 2, 25, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 32, { align: 'center' });

      // User info box
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, 40, pageWidth - 2 * margin, 25, 3, 3, 'FD');

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Colaborador:', margin + 5, 50);
      doc.setFont('helvetica', 'normal');
      doc.text(userName, margin + 45, 50);

      doc.setFont('helvetica', 'bold');
      doc.text('Período:', margin + 5, 58);
      doc.setFont('helvetica', 'normal');
      const firstDate = format(new Date(data[0].record_date + 'T00:00:00'), 'dd/MM/yyyy');
      const lastDate = format(new Date(data[data.length - 1].record_date + 'T00:00:00'), 'dd/MM/yyyy');
      doc.text(`${firstDate} a ${lastDate}`, margin + 30, 58);

      doc.setFont('helvetica', 'bold');
      doc.text('Total de registros:', pageWidth / 2 + 10, 58);
      doc.setFont('helvetica', 'normal');
      doc.text(`${data.length} dias`, pageWidth / 2 + 55, 58);

      // Calculate totals
      let totalWorkedMinutes = 0;
      const tableData = data.map(record => {
        const hours = calculateWorkedHours(record);
        
        // Parse total hours for sum
        if (hours.total !== '-') {
          const match = hours.total.match(/(\d+)h(\d+)min/);
          if (match) {
            totalWorkedMinutes += parseInt(match[1]) * 60 + parseInt(match[2]);
          }
        }

        return [
          format(new Date(record.record_date + 'T00:00:00'), 'dd/MM/yyyy'),
          record.entry_time ? format(new Date(record.entry_time), 'HH:mm') : '-',
          record.lunch_exit_time ? format(new Date(record.lunch_exit_time), 'HH:mm') : '-',
          record.lunch_return_time ? format(new Date(record.lunch_return_time), 'HH:mm') : '-',
          record.exit_time ? format(new Date(record.exit_time), 'HH:mm') : '-',
          hours.total,
        ];
      });

      const totalHours = Math.floor(totalWorkedMinutes / 60);
      const totalMins = totalWorkedMinutes % 60;
      const totalWorkedFormatted = `${totalHours}h${totalMins.toString().padStart(2, '0')}min`;

      // Table
      autoTable(doc, {
        startY: 72,
        head: [['Data', 'Entrada', 'Saída Almoço', 'Retorno', 'Saída', 'Total Dia']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          halign: 'center',
          fontSize: 9,
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' },
          5: { fontStyle: 'bold', textColor: [59, 130, 246] },
        },
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          // Footer on each page
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(
            `Página ${doc.getCurrentPageInfo().pageNumber}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
          );
        },
      });

      // Get final Y position after table
      const finalY = (doc as any).lastAutoTable.finalY || 150;

      // Summary box
      if (finalY + 60 > pageHeight - 80) {
        doc.addPage();
      }

      const summaryY = finalY + 15;
      doc.setDrawColor(59, 130, 246);
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(margin, summaryY, pageWidth - 2 * margin, 20, 3, 3, 'FD');

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('TOTAL DE HORAS TRABALHADAS:', margin + 10, summaryY + 13);
      doc.setFontSize(14);
      doc.setTextColor(59, 130, 246);
      doc.text(totalWorkedFormatted, pageWidth - margin - 10, summaryY + 13, { align: 'right' });

      // Signature section
      const signatureY = summaryY + 40;
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      // User signature
      doc.setDrawColor(100);
      doc.line(margin, signatureY + 20, margin + 70, signatureY + 20);
      doc.text('Assinatura do Colaborador', margin, signatureY + 28);
      doc.setFontSize(8);
      doc.text(userName, margin, signatureY + 35);

      // Admin signature
      doc.setFontSize(10);
      doc.line(pageWidth - margin - 70, signatureY + 20, pageWidth - margin, signatureY + 20);
      doc.text('Assinatura do Administrativo', pageWidth - margin - 70, signatureY + 28);

      // Date field
      doc.text(`Data: ____/____/________`, pageWidth / 2 - 25, signatureY + 50);

      // Legal notice
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(
        'Este documento é válido apenas com as assinaturas do colaborador e do responsável administrativo.',
        pageWidth / 2,
        signatureY + 60,
        { align: 'center' }
      );

      // Save PDF
      doc.save(`ponto_${userName.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar PDF de ponto.');
    }
  };

  const formatPunchTime = (time: string | null) => {
    if (!time) return '--:--';
    return format(new Date(time), 'HH:mm');
  };

  const formatRecordDate = (dateString: string) => {
    return format(new Date(dateString + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR });
  };

  const handleDeleteTimeRecord = async (recordId: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro de ponto?')) return;
    
    try {
      const { error } = await supabase
        .from('time_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;
      
      setTimeRecords(prev => prev.filter(r => r.id !== recordId));
    } catch (error) {
      console.error('Error deleting time record:', error);
    }
  };

  const extractTimeFromIso = (isoString: string | null): string => {
    if (!isoString) return '';
    return format(new Date(isoString), 'HH:mm');
  };

  const handleOpenEditDialog = (record: TimeRecord) => {
    setEditingRecord({
      id: record.id,
      record_date: record.record_date,
      entry_time: extractTimeFromIso(record.entry_time),
      lunch_exit_time: extractTimeFromIso(record.lunch_exit_time),
      lunch_return_time: extractTimeFromIso(record.lunch_return_time),
      exit_time: extractTimeFromIso(record.exit_time),
    });
    setEditDialogOpen(true);
  };

  const buildIsoFromTime = (date: string, time: string): string | null => {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map(Number);
    const dateObj = new Date(date + 'T00:00:00');
    dateObj.setHours(hours, minutes, 0, 0);
    return dateObj.toISOString();
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    
    setSavingEdit(true);
    try {
      const updateData = {
        entry_time: buildIsoFromTime(editingRecord.record_date, editingRecord.entry_time),
        lunch_exit_time: buildIsoFromTime(editingRecord.record_date, editingRecord.lunch_exit_time),
        lunch_return_time: buildIsoFromTime(editingRecord.record_date, editingRecord.lunch_return_time),
        exit_time: buildIsoFromTime(editingRecord.record_date, editingRecord.exit_time),
      };

      const { error } = await supabase
        .from('time_records')
        .update(updateData)
        .eq('id', editingRecord.id);

      if (error) throw error;

      // Update local state
      setTimeRecords(prev => prev.map(r => 
        r.id === editingRecord.id 
          ? { 
              ...r, 
              entry_time: updateData.entry_time,
              lunch_exit_time: updateData.lunch_exit_time,
              lunch_return_time: updateData.lunch_return_time,
              exit_time: updateData.exit_time,
            } 
          : r
      ));

      setEditDialogOpen(false);
      setEditingRecord(null);
    } catch (error) {
      console.error('Error updating time record:', error);
    } finally {
      setSavingEdit(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return formatDate(dateString);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <LogIn className="w-4 h-4 text-success" />;
      case 'download':
        return <Download className="w-4 h-4 text-primary" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'login':
        return 'Login';
      case 'download':
        return 'Download';
      case 'view':
        return 'Visualização';
      default:
        return action;
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleForceLogoutAll = async () => {
    setForceLogoutLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      const response = await supabase.functions.invoke('force-logout-all', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (result.success) {
        toast.success(`${result.logged_out_count} usuário(s) deslogado(s) com sucesso`);
      } else {
        toast.error(result.error || 'Erro ao forçar logout');
      }
    } catch (error) {
      console.error('Error forcing logout:', error);
      toast.error('Erro ao forçar logout de usuários');
    } finally {
      setForceLogoutLoading(false);
    }
  };

  // Wait for user data to be fully loaded before checking permissions
  if (!user || user.role === null) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isManagerOrAbove(user?.role)) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // User Detail View
  if (selectedUser) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in">
          {/* Header with back button */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                setSelectedUser(null);
                setUserActivities([]);
                setShowTimeRecords(false);
                setTimeRecords([]);
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-4 flex-1">
              <Avatar className="w-16 h-16">
                <AvatarImage src={selectedUser.avatar_url || undefined} />
                <AvatarFallback className="text-lg">
                  {selectedUser.full_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{selectedUser.full_name}</h1>
                <p className="text-muted-foreground">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  {selectedUser.role && <RoleBadge role={selectedUser.role} size="sm" />}
                  <Badge variant={selectedUser.is_active ? 'default' : 'secondary'}>
                    {selectedUser.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
              <Button 
                onClick={() => { setShowActivityReport(true); setShowReembolsos(false); }}
                variant={showActivityReport ? "default" : "outline"}
                className="gap-2"
              >
                <Activity className="w-4 h-4" />
                ATIVIDADE
              </Button>
              <Button 
                onClick={() => { fetchTimeRecords(selectedUser.id); setShowReembolsos(false); }}
                variant={showTimeRecords ? "default" : "outline"}
                className="gap-2"
                disabled={loadingTimeRecords}
              >
                {loadingTimeRecords ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Timer className="w-4 h-4" />
                )}
                PONTO
              </Button>
              <Button
                onClick={() => { setShowReembolsos(true); setShowActivityReport(false); setShowTimeRecords(false); }}
                variant={showReembolsos ? "default" : "outline"}
                className="gap-2"
              >
                <Receipt className="w-4 h-4" />
                REEMBOLSOS
              </Button>
            </div>
          </div>

          {/* Reembolsos Section */}
          {showReembolsos && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  Reembolsos de {selectedUser.full_name}
                </CardTitle>
                <CardDescription>Histórico completo de solicitações de reembolso</CardDescription>
              </CardHeader>
              <CardContent>
                <ReembolsosManager userId={selectedUser.id} userName={selectedUser.full_name} canEdit={user?.role === 'dev' || user?.role === 'admin'} canDelete={user?.role === 'dev'} isAdminView />
              </CardContent>
            </Card>
          )}

          {/* Activity Report Modal */}
          {showActivityReport && (
            <Card>
              <CardContent className="pt-6">
                <UserActivityReport onClose={() => setShowActivityReport(false)} />
              </CardContent>
            </Card>
          )}

          {/* User Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total de Logins</p>
                    <p className="text-3xl font-bold mt-1">{selectedUser.total_logins}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10">
                    <LogIn className="w-6 h-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Downloads</p>
                    <p className="text-3xl font-bold mt-1">{selectedUser.total_downloads}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Download className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Último Login</p>
                    <p className="text-lg font-bold mt-1">
                      {selectedUser.last_login 
                        ? formatRelativeTime(selectedUser.last_login)
                        : 'Nunca'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/10">
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time Records Section */}
          {showTimeRecords && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="w-5 h-5 text-primary" />
                      Registro de Ponto
                    </CardTitle>
                    <CardDescription>
                      Últimos 30 dias de registros de ponto
                    </CardDescription>
                  </div>
                  {user?.role === 'dev' && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => downloadTimeRecordsCSV(selectedUser.id, selectedUser.full_name)}
                      >
                        <Download className="w-4 h-4" />
                        CSV
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        onClick={() => downloadTimeRecordsPDF(selectedUser.id, selectedUser.full_name)}
                      >
                        <FileText className="w-4 h-4" />
                        PDF
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingTimeRecords ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : timeRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <Timer className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Nenhum registro de ponto encontrado
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-center">Entrada (8h)</TableHead>
                        <TableHead className="text-center">Saída Almoço (12h)</TableHead>
                        <TableHead className="text-center">Retorno (13h)</TableHead>
                        <TableHead className="text-center">Saída (18h)</TableHead>
                        {user?.role === 'dev' && <TableHead className="text-center">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="capitalize">{formatRecordDate(record.record_date)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={record.entry_time ? "default" : "secondary"} className="font-mono">
                              {formatPunchTime(record.entry_time)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={record.lunch_exit_time ? "default" : "secondary"} className="font-mono">
                              {formatPunchTime(record.lunch_exit_time)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={record.lunch_return_time ? "default" : "secondary"} className="font-mono">
                              {formatPunchTime(record.lunch_return_time)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={record.exit_time ? "default" : "secondary"} className="font-mono">
                              {formatPunchTime(record.exit_time)}
                            </Badge>
                          </TableCell>
                          {user?.role === 'dev' && (
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={() => handleOpenEditDialog(record)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteTimeRecord(record.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Histórico de Atividades
              </CardTitle>
              <CardDescription>
                Últimas 100 atividades do usuário
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingActivities ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {formatDate(activity.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(activity.action)}
                            <span className="font-medium">
                              {getActionLabel(activity.action)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {activity.resource_type || 'Sistema'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {activity.resource_name || '-'}
                        </TableCell>
                        <TableCell>
                          {activity.ip_address ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Globe className="w-3 h-3" />
                              <span className="font-mono text-xs">{activity.ip_address}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {userActivities.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12">
                          <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">
                            Nenhuma atividade registrada para este usuário
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Time Record Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                Editar Registro de Ponto
              </DialogTitle>
              <DialogDescription>
                {editingRecord && (
                  <span className="capitalize">
                    {format(new Date(editingRecord.record_date + 'T00:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {editingRecord && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="entry_time" className="text-right">
                    Entrada
                  </Label>
                  <Input
                    id="entry_time"
                    type="time"
                    value={editingRecord.entry_time}
                    onChange={(e) => setEditingRecord({ ...editingRecord, entry_time: e.target.value })}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="lunch_exit_time" className="text-right">
                    Saída Almoço
                  </Label>
                  <Input
                    id="lunch_exit_time"
                    type="time"
                    value={editingRecord.lunch_exit_time}
                    onChange={(e) => setEditingRecord({ ...editingRecord, lunch_exit_time: e.target.value })}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="lunch_return_time" className="text-right">
                    Retorno
                  </Label>
                  <Input
                    id="lunch_return_time"
                    type="time"
                    value={editingRecord.lunch_return_time}
                    onChange={(e) => setEditingRecord({ ...editingRecord, lunch_return_time: e.target.value })}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="exit_time" className="text-right">
                    Saída
                  </Label>
                  <Input
                    id="exit_time"
                    type="time"
                    value={editingRecord.exit_time}
                    onChange={(e) => setEditingRecord({ ...editingRecord, exit_time: e.target.value })}
                    className="col-span-3 font-mono"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingRecord(null);
                }}
                disabled={savingEdit}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  // Users List View
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">Métricas e análises do sistema</p>
          </div>
          
          {hasFullAccess(user?.role) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="gap-2"
                  disabled={forceLogoutLoading}
                >
                  {forceLogoutLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  Forçar Logout de Todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Confirmar Logout Forçado
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá deslogar <strong>todos os usuários ativos</strong> do sistema imediatamente, 
                    exceto você. As sessões de atividade serão encerradas e os usuários precisarão fazer login novamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleForceLogoutAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirmar Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Logins</p>
                  <p className="text-3xl font-bold mt-1">{loading ? '-' : stats.totalLogins}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Activity className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Usuários Ativos</p>
                  <p className="text-3xl font-bold mt-1">{loading ? '-' : stats.uniqueUsers}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <Users className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Logins Hoje</p>
                  <p className="text-3xl font-bold mt-1">{loading ? '-' : stats.todayLogins}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10">
                  <TrendingUp className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Usuários
            </CardTitle>
            <CardDescription>
              Selecione um usuário para ver o relatório completo de atividades
            </CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead className="text-center">Logins</TableHead>
                    <TableHead className="text-center">Downloads</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((userProfile) => (
                    <TableRow 
                      key={userProfile.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSelectUser(userProfile)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={userProfile.avatar_url || undefined} />
                            <AvatarFallback>
                              {userProfile.full_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{userProfile.full_name}</p>
                            <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {userProfile.role ? (
                          <RoleBadge role={userProfile.role} size="sm" />
                        ) : (
                          <Badge variant="outline">Sem cargo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {userProfile.last_login 
                          ? formatRelativeTime(userProfile.last_login)
                          : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{userProfile.total_logins}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{userProfile.total_downloads}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <FileText className="w-4 h-4 mr-1" />
                          Ver Relatório
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Nenhum usuário encontrado</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
