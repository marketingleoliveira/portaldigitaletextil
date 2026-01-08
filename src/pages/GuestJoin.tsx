import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, User, Lock, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/Logo";

export default function GuestJoin() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  const [guestName, setGuestName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsPassword, setNeedsPassword] = useState<boolean | null>(null);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [error, setError] = useState("");
  const [checkingMeeting, setCheckingMeeting] = useState(true);

  // Check if meeting exists and requires password
  useEffect(() => {
    const checkMeeting = async () => {
      if (!code) {
        setError("Código de reunião inválido");
        setCheckingMeeting(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("meetings")
          .select("title, password, is_active")
          .eq("meeting_code", code)
          .single();

        if (error || !data) {
          setError("Reunião não encontrada");
          setCheckingMeeting(false);
          return;
        }

        if (!data.is_active) {
          setError("Esta reunião já foi encerrada");
          setCheckingMeeting(false);
          return;
        }

        setMeetingTitle(data.title);
        setNeedsPassword(!!data.password);
        setCheckingMeeting(false);
      } catch (err) {
        console.error("Error checking meeting:", err);
        setError("Erro ao verificar reunião");
        setCheckingMeeting(false);
      }
    };

    checkMeeting();
  }, [code]);

  const handleJoin = async () => {
    if (!guestName.trim()) {
      toast.error("Por favor, insira seu nome");
      return;
    }

    if (!code) return;

    setLoading(true);
    setError("");

    try {
      // Verify meeting and password if needed
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select("id, password, is_active")
        .eq("meeting_code", code)
        .single();

      if (meetingError || !meeting) {
        setError("Reunião não encontrada");
        setLoading(false);
        return;
      }

      if (!meeting.is_active) {
        setError("Esta reunião já foi encerrada");
        setLoading(false);
        return;
      }

      if (meeting.password && password !== meeting.password) {
        setError("Senha incorreta");
        setLoading(false);
        return;
      }

      // Generate a guest ID
      const guestId = crypto.randomUUID();

      // Store guest info in sessionStorage for the meeting room
      sessionStorage.setItem(`guest_${code}`, JSON.stringify({
        guestId,
        guestName: guestName.trim(),
        meetingId: meeting.id
      }));

      // Navigate to guest meeting room
      navigate(`/convidado/${code}`);

    } catch (err) {
      console.error("Error joining meeting:", err);
      setError("Erro ao entrar na reunião");
      setLoading(false);
    }
  };

  if (checkingMeeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando reunião...</p>
        </div>
      </div>
    );
  }

  if (error && !needsPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Logo size="lg" className="mx-auto mb-4" />
            <CardTitle className="text-destructive">Erro</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate("/")}
            >
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Entrar na Reunião</CardTitle>
          <CardDescription>
            {meetingTitle || `Código: ${code}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guestName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Seu nome
            </Label>
            <Input
              id="guestName"
              placeholder="Digite seu nome"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              autoFocus
            />
          </div>

          {needsPassword && (
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Senha da reunião
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite a senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button 
            className="w-full" 
            onClick={handleJoin}
            disabled={loading || !guestName.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Entrando...
              </>
            ) : (
              <>
                Entrar na Reunião
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground pt-2">
            <p>Você entrará como convidado</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
