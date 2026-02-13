import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface MeetingErrorBoundaryProps {
  children: React.ReactNode;
}

interface MeetingErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class MeetingErrorBoundary extends React.Component<MeetingErrorBoundaryProps, MeetingErrorBoundaryState> {
  constructor(props: MeetingErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<MeetingErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Meeting ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoBack = () => {
    window.location.href = '/reunioes';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Erro na Reunião</h1>
            <p className="text-muted-foreground mb-4">
              Ocorreu um erro ao carregar a reunião. Isso pode acontecer por problemas de conexão ou permissões de câmera/microfone.
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg mb-6 text-left font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleRetry} variant="default" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </Button>
              <Button onClick={this.handleGoBack} variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar às Reuniões
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MeetingErrorBoundary;
